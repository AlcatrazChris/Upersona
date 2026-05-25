/**
 * scripts/seed.mjs  —  v4  扩充本地规则 + 新8类职业口径
 * 用法：node scripts/seed.mjs <excel文件路径>
 */

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { config } from './env.mjs';

const DEEPSEEK_BASE  = 'https://api.deepseek.com/v1';
const BATCH_SIZE     = 30;
const INSERT_BATCH   = 100;

const OCCUPATION_CATEGORIES = [
  '管理人员', '工程技术人员', '白领', '公职人员',
  '个体户', '基层劳动者', '自由职业', '其他',
];

// ── 本地兜底规则（顺序敏感，精确规则在前）──────────────────────
const LOCAL_RULES = [
  {
    kw: ['公务员','警察','教师','医生','军人','事业单位','编制','公职','国企','机关',
         '政府','事业编','老师','护士','医务','军队','部队','武警','消防','海关',
         '税务','法院','检察','央企'],
    cat: '公职人员',
  },
  {
    kw: ['总经理','董事长','总监','主管','经理','高管','ceo','coo','cto','负责人',
         '创始','投资人','企业主','企业负责人','企业管理人员','企业管理','商业管理',
         '管理人员','私企管理'],
    cat: '管理人员',
  },
  {
    kw: ['工程师','程序员','开发','技术','it','设计师','会计','律师','建筑师','架构',
         '研发','科研','工程类','工程','土木','机械','电气','电力','通讯','通信',
         '互联网','信息','轨道交通','高铁','汽车制造','电子','航空','质检','检测',
         '咨询','财务','兽医','新媒体','教育行业','建筑业','医疗'],
    cat: '工程技术人员',
  },
  {
    kw: ['职员','文员','行政','hr','运营','市场','销售','客服','金融','审计','策划',
         '文职','业务员','业务','外勤','传媒','银行','保险','证券','电商','汽车营销',
         '汽车行业','培训','上班族','上班','普通职工','普通牛马','企业职工','企业职员',
         '员工','公司员工','公司职员','企业员工','工作人员','职工','普通员工',
         '车企员工','白领'],
    cat: '白领',
  },
  {
    kw: ['个体','老板','私营','自营','开店','做生意','小老板','经商','经营',
         '自有公司','小作坊','餐饮店','零售','服装','物业管理','全屋定制','装饰工程'],
    cat: '个体户',
  },
  {
    kw: ['工人','蓝领','司机','驾驶','电工','技工','建筑工','体力','搬运','农','渔',
         '厨师','工厂','务工','制造业','安装','服务类','服务行业','服务人员','服务业',
         '保安','物流','快递','外卖','保洁','保姆','餐饮','物业'],
    cat: '基层劳动者',
  },
  {
    kw: ['自由','宝妈','全职妈','自媒体','主播','up主','博主','斜杠',
         '在家带娃','灵活就业','导演','摄影师'],
    cat: '自由职业',
  },
  {
    kw: ['学生','退休','无业','待业','失业','离休','保密','老百姓','牛马','服务人民'],
    cat: '其他',
  },
];

function classifyLocal(raw) {
  const lower = String(raw).toLowerCase().trim();
  if (!lower || ['nan','-','/','?','？','无'].includes(lower)) return '其他';
  for (const { kw, cat } of LOCAL_RULES) {
    if (kw.some(k => lower.includes(k))) return cat;
  }
  return '其他';
}

function parseMultiSelect(raw) {
  if (!raw || raw === '(跳过)') return [];
  return String(raw).split('┋').map(v => v.trim()).filter(Boolean)
    .map(v => (/^其他[〖（(]/.test(v) ? '其他' : v));
}

function mapIntentLabel(orderStatus) {
  return (orderStatus === '已锁单' || orderStatus === '订单完成') ? 1 : 0;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── DeepSeek 批量分类 ────────────────────────────────────────
async function classifyBatch(rawTexts, apiKey) {
  if (!apiKey) {
    console.log('  📝 无 API Key，使用本地规则...');
    return Object.fromEntries(rawTexts.map(t => [t, classifyLocal(t)]));
  }
  try {
    const prompt =
`你是职业分类专家。将下列职业描述分别归入以下8类之一：
1. 管理人员（总经理/副总/高管/总监/经理/主管/负责人/创始人/投资人/董事等）
2. 工程技术人员（工程师/IT/程序员/开发/设计师/会计/律师/医师/技术/研发/科研人员等）
3. 白领（职员/文员/行政/HR/运营/市场/销售/客服/金融/采购/助理等非技术普通岗位）
4. 公职人员（公务员/军人/警察/教师/医生/护士/事业单位/国企/编制）
5. 个体户（个体户/小老板/私营业主/自营/开店/经商）
6. 基层劳动者（工人/蓝领/驾驶员/电工/技工/建筑工/农民/快递/外卖/保安/服务员/厨师等）
7. 自由职业（自由职业者/自媒体/主播/博主/宝妈/全职妈妈/灵活就业）
8. 其他（学生/退休/离休/无业/无法判断/符号/笔名等）

分类边界说明：
- "工程"类单字词：优先考虑工程技术人员
- "员工/职工/职员/公司员工"：白领
- "制造业"：若无具体岗位信息，归基层劳动者
- "医疗/教育行业"：泛指行业的归工程技术人员（含专业人员）
- "管理"单字/管理岗：有负责人含义的归管理人员，否则归白领

待分类（每行一个）：
${rawTexts.map((t,i) => `${i+1}. ${t}`).join('\n')}

严格按此JSON返回，不输出其他内容：
{"results":[{"raw":"原文","category":"分类"}]}`;

    const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 2048 }),
    });
    if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const content = data.choices[0].message.content.trim();
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('DeepSeek returned invalid JSON');
    const parsed = JSON.parse(m[0]);
    const mapping = {};
    for (const item of parsed.results) {
      mapping[item.raw] = OCCUPATION_CATEGORIES.includes(item.category) ? item.category : classifyLocal(item.raw);
    }
    return mapping;
  } catch (err) {
    console.log(`  ⚠️  DeepSeek 失败，降级到本地规则: ${err.message}`);
    return Object.fromEntries(rawTexts.map(t => [t, classifyLocal(t)]));
  }
}

// ── 主流程 ───────────────────────────────────────────────────
async function main() {
  const filePath = process.argv[2];
  if (!filePath) { console.error('用法: node scripts/seed.mjs <excel文件路径>'); process.exit(1); }

  const { supabaseUrl, supabaseServiceKey, deepseekApiKey } = config;
  const db = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  console.log(`📂 读取文件: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Sheet1'];
  if (!sheet) throw new Error('找不到 Sheet1');
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`✅ 共读取 ${rows.length} 行`);

  const allRaw = [...new Set(rows.map(r => String(r['职业'] || '').trim()))].filter(Boolean);
  console.log(`🔍 发现 ${allRaw.length} 种唯一职业`);

  // 清理旧口径缓存
  console.log('🧹 清理旧口径职业缓存...');
  const validCats = OCCUPATION_CATEGORIES.map(c => `"${c}"`).join(',');
  await db.from('occupation_mapping').delete().not('category', 'in', `(${validCats})`);

  const { data: existingMappings } = await db.from('occupation_mapping')
    .select('raw_text, category').in('raw_text', allRaw);
  const cachedMap = {};
  for (const m of existingMappings || []) cachedMap[m.raw_text] = m.category;
  console.log(`💾 缓存命中: ${Object.keys(cachedMap).length} 条`);

  // 对未命中缓存的先跑本地规则，仍是"其他"的再送 DeepSeek
  const uncached = allRaw.filter(o => !cachedMap[o]);
  const preClassified = {};
  const needAI = [];
  for (const t of uncached) {
    const local = classifyLocal(t);
    if (local !== '其他') {
      preClassified[t] = local;
    } else {
      needAI.push(t);
    }
  }
  console.log(`⚡ 本地规则命中: ${Object.keys(preClassified).length} 条`);
  console.log(`🤖 送 DeepSeek: ${needAI.length} 条（本地无法判断的"其他"）`);

  const newMappings = { ...preClassified };
  for (let i = 0; i < needAI.length; i += BATCH_SIZE) {
    const batch = needAI.slice(i, i + BATCH_SIZE);
    console.log(`  批次 ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(needAI.length/BATCH_SIZE)}: ${batch.length} 条...`);
    const result = await classifyBatch(batch, deepseekApiKey);
    Object.assign(newMappings, result);
    if (i + BATCH_SIZE < needAI.length) await sleep(500);
  }

  // 保存新映射
  if (Object.keys(newMappings).length > 0) {
    const toInsert = Object.entries(newMappings).map(([raw_text, category]) => ({
      raw_text, category, mapped_at: new Date().toISOString(),
    }));
    const { error } = await db.from('occupation_mapping')
      .upsert(toInsert, { onConflict: 'raw_text', ignoreDuplicates: false });
    if (error) console.warn(`⚠️ 保存缓存出错: ${error.message}`);
    else console.log(`✅ 保存 ${toInsert.length} 条新映射`);
  }

  const fullOccMap = { ...cachedMap, ...newMappings };

  // 打印分布
  const distrib = {};
  for (const occ of allRaw) {
    const cat = fullOccMap[occ] || '其他';
    distrib[cat] = (distrib[cat] || 0) + 1;
  }
  console.log('\n职业分类分布（唯一职业文本维度）:');
  Object.entries(distrib).sort((a,b) => b[1]-a[1]).forEach(([cat, cnt]) => console.log(`  ${cat}: ${cnt}`));

  // 创建版本
  const { data: versionRow, error: vErr } = await db.from('data_versions')
    .insert({ record_count: rows.length, is_active: false }).select().single();
  if (vErr) throw new Error(`创建版本失败: ${vErr.message}`);
  const versionId = versionRow.version_id;
  console.log(`\n📋 创建数据版本 v${versionId}`);

  // 插入 users
  console.log(`📝 写入 users 表...`);
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
        occupation_category:   fullOccMap[occRaw] || classifyLocal(occRaw),
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
        finance_term:          parseInt(String(r['金融期数'] || '0'), 10) || 0,
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

  // 激活
  const { error: aErr } = await db.rpc('set_active_version', { v_id: versionId });
  if (aErr) throw new Error(`激活版本失败: ${aErr.message}`);

  console.log(`\n🎉 完成！版本 v${versionId} 已激活`);
  console.log(`   总记录数: ${rows.length}`);
  const strong = rows.filter(r => ['已锁单','订单完成'].includes(String(r['订单状态']))).length;
  console.log(`   强意向: ${strong}  弱意向: ${rows.length - strong}`);
}

main().catch(err => { console.error('❌ 失败:', err.message); process.exit(1); });
