import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';
import * as XLSX from 'xlsx';
import { classifyOccupations } from '@/lib/deepseek';
import { parseMultiSelect } from '@/lib/utils';
import { getCityTier } from '@/lib/city-tiers';
import {
  cleanRow, batchCleanUnresolved,
  STD_AGE_GROUP, STD_EDUCATION, STD_FAMILY, STD_INCOME, STD_IS_UPGRADE, STD_ORDER_STATUS,
} from '@/lib/data-cleaner';

export const dynamic  = 'force-dynamic';
export const maxDuration = 120;   // 增加到 120 秒，为数据清洗留出时间

const INSERT_BATCH = 100;

const VALID_OCC = [
  '管理人员', '工程技术人员', '白领', '公职人员',
  '个体户', '基层劳动者', '自由职业', '其他',
];

function mapIntentLabel(orderStatus: string): 0 | 1 {
  return orderStatus === '已锁单' || orderStatus === '订单完成' ? 1 : 0;
}

export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const db = createServiceClient();

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '未找到上传文件' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['Sheet1'];
    if (!sheet) return NextResponse.json({ error: '找不到 Sheet1' }, { status: 400 });

    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, string>[];
    if (rows.length === 0) return NextResponse.json({ error: '数据为空' }, { status: 400 });

    // ── Phase 1：职业分类 ─────────────────────────────────────────
    const allOccupations = [...new Set(rows.map(r => String(r['职业'] || '').trim()))].filter(Boolean);

    await db.from('occupation_mapping').delete()
      .not('category', 'in', `(${VALID_OCC.map(c => `"${c}"`).join(',')})`);

    const { data: existingMappings } = await db
      .from('occupation_mapping')
      .select('raw_text, category')
      .in('raw_text', allOccupations);

    const cachedMap: Record<string, string> = {};
    for (const m of existingMappings || []) {
      cachedMap[m.raw_text] = m.category;
    }

    const uncached = allOccupations.filter(o => !cachedMap[o]);
    let newMappings: Record<string, string> = {};
    if (uncached.length > 0) {
      const BATCH = 30;
      for (let i = 0; i < uncached.length; i += BATCH) {
        const batch = uncached.slice(i, i + BATCH);
        try {
          const result = await classifyOccupations(batch);
          Object.assign(newMappings, result);
        } catch {
          for (const t of batch) newMappings[t] = '其他';
        }
        if (i + BATCH < uncached.length) await new Promise(r => setTimeout(r, 300));
      }
      const toUpsert = Object.entries(newMappings).map(([raw_text, category]) => ({
        raw_text, category, mapped_at: new Date().toISOString(),
      }));
      await db.from('occupation_mapping').upsert(toUpsert, { onConflict: 'raw_text', ignoreDuplicates: false });
    }
    const fullOccMap = { ...cachedMap, ...newMappings };

    // ── Phase 2：结构化字段规则清洗 ───────────────────────────────
    type FieldName = 'age_group' | 'education' | 'family_structure' | 'annual_income' | 'is_upgrade' | 'order_status';
    const FIELD_OPTIONS: Record<FieldName, readonly string[]> = {
      age_group:        STD_AGE_GROUP,
      education:        STD_EDUCATION,
      family_structure: STD_FAMILY,
      annual_income:    STD_INCOME,
      is_upgrade:       STD_IS_UPGRADE,
      order_status:     STD_ORDER_STATUS,
    };

    let ruleCleanedCount = 0;
    const aiPending: { field: FieldName; raw: string; options: string[] }[] = [];
    const aiPendingSet = new Set<string>(); // field::raw → avoid duplicate AI requests

    // 预扫所有行，收集规则无法处理的值
    const rowCleans = rows.map(r => {
      const raw = {
        age_group:        String(r['年龄段'] || ''),
        education:        String(r['学历'] || ''),
        family_structure: String(r['家庭结构'] || ''),
        annual_income:    String(r['家庭年收入'] || ''),
        is_upgrade:       String(r['是否增换购'] || ''),
        order_status:     String(r['订单状态'] || ''),
      };
      const result = cleanRow(raw);
      for (const [field, res] of Object.entries(result) as [FieldName, { value: string; changed: boolean }][]) {
        if (res.changed) ruleCleanedCount++;
        // 如果清洗后仍不是标准值 → 标记给 AI
        if (res.value && !(FIELD_OPTIONS[field] as readonly string[]).includes(res.value)) {
          const key = `${field}::${res.value}`;
          if (!aiPendingSet.has(key)) {
            aiPendingSet.add(key);
            aiPending.push({ field, raw: res.value, options: Array.from(FIELD_OPTIONS[field]) });
          }
        }
      }
      return { raw, result };
    });

    // ── Phase 3：AI 批量兜底清洗（仅处理规则识别不了的值）──────────
    let aiCleanMap: Record<string, string> = {};
    let aiCleanedCount = 0;
    if (aiPending.length > 0) {
      // 分批，每批最多 50 条
      const AI_BATCH = 50;
      for (let i = 0; i < aiPending.length; i += AI_BATCH) {
        const batch = aiPending.slice(i, i + AI_BATCH);
        try {
          const partialMap = await batchCleanUnresolved(batch);
          Object.assign(aiCleanMap, partialMap);
        } catch { /* AI 失败时保留原值 */ }
      }
      aiCleanedCount = Object.keys(aiCleanMap).length;
    }

    // ── Phase 4：检测可选列是否已在数据库中创建 ──────────────────
    const { error: cityTierColErr }     = await db.from('users').select('city_tier').limit(0);
    const hasCityTierCol                = !cityTierColErr;
    const { error: qiankunColErr }      = await db.from('users').select('is_qiankun_owner').limit(0);
    const hasQiankunCol                 = !qiankunColErr; // 需先执行 supabase/add_qiankun_owner.sql

    // ── Phase 5：创建版本并插入数据 ──────────────────────────────
    const { data: versionRow, error: vErr } = await db
      .from('data_versions')
      .insert({ record_count: rows.length, is_active: false })
      .select()
      .single();
    if (vErr) throw new Error(`创建版本失败: ${vErr.message}`);
    const versionId = versionRow.version_id;

    // 最终清洗：规则结果 + AI 兜底
    function resolveField(field: FieldName, ruleValue: string): string {
      if ((FIELD_OPTIONS[field] as readonly string[]).includes(ruleValue)) return ruleValue;
      const key = `${field}::${ruleValue}`;
      return aiCleanMap[key] ?? ruleValue; // AI 有结果用AI，否则保留原值
    }

    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH);
      const records = batch.map((r, idx) => {
        const occRaw  = String(r['职业'] || '').trim();
        const city    = String(r['城市'] || '');
        const { result } = rowCleans[i + idx];

        const base = {
          data_version:          versionId,
          name:                  String(r['姓名'] || ''),
          region_area:           String(r['大区'] || ''),
          region_province:       String(r['省份'] || ''),
          region_city:           city,
          age_group:             resolveField('age_group',        result.age_group.value),
          education:             resolveField('education',        result.education.value),
          occupation_raw:        occRaw,
          // 空白职业保持空白，非空才分类
          occupation_category:   occRaw ? (fullOccMap[occRaw] || '其他') : '',
          family_structure:      resolveField('family_structure', result.family_structure.value),
          annual_income:         resolveField('annual_income',    result.annual_income.value),
          is_upgrade:            resolveField('is_upgrade',       result.is_upgrade.value),
          consumption_views:     parseMultiSelect(r['消费观念']),
          competing_models:      parseMultiSelect(r['对比车型']),
          use_scenarios:         parseMultiSelect(r['用车场景']),
          family_trip_frequency: parseMultiSelect(r['与老人小孩全家出行频率']),
          info_channels:         parseMultiSelect(r['了解华境S的渠道']),
          car_interests:         parseMultiSelect(r['关注的汽车内容']),
          hobbies:               parseMultiSelect(r['日常爱好']),
          finance_term:          parseInt(String(r['金融期数'] || '0'), 10) || 0,
          order_status:  resolveField('order_status', result.order_status.value),
          intent_label:  mapIntentLabel(resolveField('order_status', result.order_status.value)),
        };
        // 仅当可选列存在时才写入（列不存在时 PostgREST 会报错）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const record: Record<string, any> = { ...base };
        if (hasCityTierCol)  record.city_tier        = getCityTier(city);
        if (hasQiankunCol)   record.is_qiankun_owner = String(r['是否乾坤注册车主'] || '');
        return record;
      });

      const { error: iErr } = await db.from('users').insert(records);
      if (iErr) throw new Error(`插入数据失败: ${iErr.message}`);
    }

    // 激活新版本
    await db.rpc('set_active_version', { v_id: versionId });

    // 清除旧版本 AI 洞察缓存
    await db.from('insights_cache').delete()
      .gt('data_version', 0)
      .lt('data_version', versionId);

    revalidatePath('/', 'layout');

    return NextResponse.json({
      success: true,
      versionId,
      recordCount: rows.length,
      hasCityTier: hasCityTierCol,
      cleaning: {
        ruleCleanedCount,
        aiCleanedCount,
        message: ruleCleanedCount + aiCleanedCount > 0
          ? `自动清洗 ${ruleCleanedCount} 处（规则）+ ${aiCleanedCount} 处（AI 兜底）`
          : '数据规范，无需清洗',
      },
      newOccMappings:    Object.keys(newMappings).length,
      cachedOccMappings: Object.keys(cachedMap).length,
      message: `数据版本 v${versionId} 已激活，页面缓存已刷新`,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
