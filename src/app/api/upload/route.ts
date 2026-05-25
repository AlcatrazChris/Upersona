import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { classifyOccupations } from '@/lib/deepseek';
import { parseMultiSelect } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const INSERT_BATCH = 100;

const VALID_OCC = [
  '管理人员', '工程技术人员', '白领', '公职人员',
  '个体户', '基层劳动者', '自由职业', '其他',
];

function mapIntentLabel(orderStatus: string): 0 | 1 {
  return orderStatus === '已锁单' || orderStatus === '订单完成' ? 1 : 0;
}

function checkAuth(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password') || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return process.env.NODE_ENV !== 'production';
  return provided === expected;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: '认证失败：密码错误或未设置 ADMIN_PASSWORD 环境变量' }, { status: 401 });
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

    const allOccupations = [...new Set(rows.map(r => String(r['职业'] || '').trim()))].filter(Boolean);

    // 清理旧口径缓存
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
        if (i + BATCH < uncached.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      const toUpsert = Object.entries(newMappings).map(([raw_text, category]) => ({
        raw_text, category, mapped_at: new Date().toISOString(),
      }));
      await db.from('occupation_mapping').upsert(toUpsert, { onConflict: 'raw_text', ignoreDuplicates: false });
    }

    const fullOccMap = { ...cachedMap, ...newMappings };

    const { data: versionRow, error: vErr } = await db
      .from('data_versions')
      .insert({ record_count: rows.length, is_active: false })
      .select()
      .single();

    if (vErr) throw new Error(`创建版本失败: ${vErr.message}`);
    const versionId = versionRow.version_id;

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
          finance_term:          parseInt(String(r['金融期数'] || '0'), 10) || 0,
          order_status:          String(r['订单状态'] || ''),
          intent_label:          mapIntentLabel(String(r['订单状态'] || '')),
        };
      });

      const { error: iErr } = await db.from('users').insert(records);
      if (iErr) throw new Error(`插入数据失败: ${iErr.message}`);
    }

    // 激活新版本
    await db.rpc('set_active_version', { v_id: versionId });

    // 清除所有 AI 洞察缓存（新数据入库后旧缓存失效）
    await db.from('insights_cache').delete().lt('version_id', versionId);

    // ── 关键：触发 Next.js revalidate，清除 Server Component 缓存 ──
    revalidatePath('/', 'layout');   // 清除所有路由缓存

    return NextResponse.json({
      success: true,
      versionId,
      recordCount: rows.length,
      newOccMappings: Object.keys(newMappings).length,
      cachedOccMappings: Object.keys(cachedMap).length,
      message: `数据版本 v${versionId} 已激活，页面缓存已刷新`,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
