/**
 * scripts/seed.mjs
 * 数据预处理与入库脚本
 *
 * 用法：
 *   node scripts/seed.mjs ./your-data.xlsx
 *
 * 功能：
 *   1. 读取 Excel 文件（Sheet1）
 *   2. 查询 occupation_mapping 缓存，对新出现的职业调用 DeepSeek 分类
 *   3. 解析多选字段，归并长尾"其他〖...〗"
 *   4. 创建新数据版本，批量写入 users 表
 *   5. 激活新版本
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { config } from './env.mjs';

// ============================================================
// 配置
// ============================================================
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const BATCH_SIZE = 30;    // DeepSeek 每批分类数量
const INSERT_BATCH = 100; // 数据库每批插入数量

// 10 个职业分类（简洁、有区分度）
const OCCUPATION_CATEGORIES = [
  '管理层',     // 企业/公司管理层
  '专业人士',   // 工程师、医生、教师、律师、设计师等
  '白领',       // 一般职员、文员、销售、行政、金融等
  '公职',       // 公务员、事业单位、国企
  '个体户',     // 个体经营/自营/小老板
  '自媒体',     // 自媒体、主播、UP主、内容创作者
  '蓝领',       // 工人、技工、司机、农民等
  '服务业',     // 服务员、保安、快递、客服等一线服务
  '自由职业',   // 自由职业者、灵活就业
  '其他',       // 学生、退休、无业、保密、无法归类
];

// ============================================================
// 工具函数
// ============================================================

function parseMultiSelect(raw) {
  if (!raw || raw === '(跳过)') return [];
  return raw
    .split('┋')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => {
      if (/^其他[〖（(]/.test(v)) return '其他';
      return v;
    });
}

function mapIntentLabel(orderStatus) {
  if (orderStatus === '已锁单' || orderStatus === '订单完成') return 1;
  return 0;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================
// DeepSeek 职业批量分类
// ============================================================

async function classifyBatch(rawTexts, apiKey) {
  const prompt = `你是职业分类专家。将下列职业描述分别归入以下10类之一：
${OCCUPATION_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

分类说明：
- 管理层：总经理、高管、经理、总监、企业主、投资人等
- 专业人士：工程师、IT/程序员、医生、教师、律师、设计师、会计师、导演、摄影师等
- 白领：一般职员、文员、行政、HR、普通职工、金融/银行从业者、销售（非管理）等
- 公职：公务员、事业单位人员、国企员工、教师/医生（编制内）、警察等
- 个体户：个体经营、小老板、自营、开店、网店店主等
- 自媒体：自媒体、主播、UP主、视频创作者、网红等
- 蓝领：工厂工人、建筑工人、驾驶员、电工、技工、农民、厨师等
- 服务业：服务员、保安、保洁、快递/外卖员、零售导购、一线客服等
- 自由职业：自由职业者、灵活就业、无固定雇主（非学生/无业）
- 其他：无法判断、，以及学生、退休、无业、保密、空值

待分类（每行一个）：
${rawTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

严格按此JSON返回，不输出其他内容：
{"results":[{"raw":"原文","category":"分类"}]}`;

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content.trim();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('DeepSeek returned invalid JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  const mapping = {};
  for (const item of parsed.results) {
    mapping[item.raw] = OCCUPATION_CATEGORIES.includes(item.category)
      ? item.category : '其他';
  }
  return mapping;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('用法: node scripts/seed.mjs <excel文件路径>');
    process.exit(1);
  }

  const { supabaseUrl, supabaseServiceKey, deepseekApiKey } = config;
  const db = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // --- 1. 读取 Excel ---
  console.log(`📂 读取文件: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Sheet1'];
  if (!sheet) throw new Error('找不到 Sheet1');

  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`✅ 共读取 ${rows.length} 行`);

  // --- 2. 提取所有唯一职业 ---
  const allRawOccupations = [...new Set(rows.map(r => String(r['职业'] || '').trim()))].filter(Boolean);
  console.log(`🔍 发现 ${allRawOccupations.length} 种唯一职业`);

  // --- 3. 从缓存表查询已有映射 ---
  const { data: existingMappings } = await db
    .from('occupation_mapping')
    .select('raw_text, category')
    .in('raw_text', allRawOccupations);

  const cachedMap = {};
  for (const m of existingMappings || []) {
    cachedMap[m.raw_text] = m.category;
  }
  console.log(`💾 缓存命中: ${Object.keys(cachedMap).length} 条`);

  // --- 4. 对新职业调用 DeepSeek 分类 ---
  const uncached = allRawOccupations.filter(o => !cachedMap[o]);
  console.log(`🤖 需要 DeepSeek 分类: ${uncached.length} 条`);

  const newMappings = {};
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    console.log(`  批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uncached.length / BATCH_SIZE)}：分类 ${batch.length} 条...`);

    try {
      const result = await classifyBatch(batch, deepseekApiKey);
      Object.assign(newMappings, result);
    } catch (err) {
      console.warn(`  ⚠️ 批次分类失败，回退为"其他": ${err.message}`);
      for (const t of batch) newMappings[t] = '其他';
    }

    // 避免速率限制
    if (i + BATCH_SIZE < uncached.length) await sleep(500);
  }

  // --- 5. 保存新映射到缓存表 ---
  if (Object.keys(newMappings).length > 0) {
    const toInsert = Object.entries(newMappings).map(([raw_text, category]) => ({
      raw_text,
      category,
      mapped_at: new Date().toISOString(),
    }));

    // upsert：如果 raw_text 已存在则跳过（保持一致性）
    const { error } = await db
      .from('occupation_mapping')
      .upsert(toInsert, { onConflict: 'raw_text', ignoreDuplicates: true });

    if (error) console.warn(`⚠️ 保存映射缓存时出错: ${error.message}`);
    else console.log(`✅ 保存 ${toInsert.length} 条新映射到缓存`);
  }

  // 合并完整映射
  const fullOccMap = { ...cachedMap, ...newMappings };

  // --- 6. 创建新数据版本 ---
  const { data: versionRow, error: vErr } = await db
    .from('data_versions')
    .insert({ record_count: rows.length, is_active: false })
    .select()
    .single();

  if (vErr) throw new Error(`创建版本失败: ${vErr.message}`);
  const versionId = versionRow.version_id;
  console.log(`📋 创建数据版本 v${versionId}`);

  // --- 7. 转换并批量插入 users ---
  console.log(`📝 开始写入 users 表...`);
  let inserted = 0;

  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);

    const records = batch.map(r => {
      const occRaw = String(r['职业'] || '').trim();
      return {
        data_version:          versionId,
        name:                  String(r['姓名'] || ''),
        region_area:           String(r['大区'] || ''),
        region_province:       String(r['省份'] || ''),
        region_city:           String(r['城市'] || ''),
        age_group:             String(r['年龄段'] || ''),
        education:             String(r['学历'] || ''),
        occupation_raw:        occRaw,
        occupation_category:   fullOccMap[occRaw] || '其他',
        family_structure:      String(r['家庭结构'] || ''),
        annual_income:         String(r['家庭年收入'] || ''),
        is_upgrade:            String(r['是否增换购'] || ''),
        consumption_views:     parseMultiSelect(r['消费观念']),
        competing_models:      parseMultiSelect(r['对比车型']),
        use_scenarios:         parseMultiSelect(r['用车场景']),
        family_trip_frequency: parseMultiSelect(r['与老人小孩全家出行频率']),
        info_channels:         parseMultiSelect(r['了解华境S的渠道']),
        car_interests:         parseMultiSelect(r['关注的汽车内容']),
        hobbies:               parseMultiSelect(r['日常爱好']),
        order_status:          String(r['订单状态'] || ''),
        intent_label:          mapIntentLabel(String(r['订单状态'] || '')),
      };
    });

    const { error: iErr } = await db.from('users').insert(records);
    if (iErr) throw new Error(`插入失败（批次 ${i}）: ${iErr.message}`);

    inserted += records.length;
    process.stdout.write(`\r  已写入 ${inserted}/${rows.length}`);
  }
  console.log(`\n✅ users 写入完成`);

  // --- 8. 激活新版本（RPC 函数） ---
  const { error: aErr } = await db.rpc('set_active_version', { v_id: versionId });
  if (aErr) throw new Error(`激活版本失败: ${aErr.message}`);

  console.log(`\n🎉 完成！数据版本 v${versionId} 已激活`);
  console.log(`   总记录数: ${rows.length}`);
  console.log(`   强意向(已锁单+完成): ${rows.filter(r => ['已锁单','订单完成'].includes(String(r['订单状态']))).length}`);
  console.log(`   弱意向(未锁单): ${rows.filter(r => r['订单状态'] === '未锁单').length}`);
}

main().catch(err => {
  console.error('\n❌ 脚本执行失败:', err.message);
  process.exit(1);
});