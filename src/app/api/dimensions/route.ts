import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';
import { getDimensions, clearDimensionCache } from '@/lib/dimensions';
import { PROFILE_DIMENSIONS } from '@/types';

export const dynamic = 'force-dynamic';

// 进程内种子标志——只在首次请求时执行 upsert，避免每次 GET 都写 DB
let _seeded = false;

// ── GET: 返回全部维度配置（公开）─────────────────────────────
export async function GET() {
  const db = createServiceClient();

  // 自动种子：仅在进程首次请求时执行
  if (!_seeded) {
    try {
      const seeds = PROFILE_DIMENSIONS.map((d, i) => ({
        dim_key:         d.key as string,
        label:           d.label,
        is_ordered:      d.isOrdered,
        is_multi_select: d.isMultiSelect,
        ordered_values:  d.orderedValues ?? null,
        note:            d.note ?? null,
        field_type:      d.isMultiSelect ? 'multi' : 'category',
        enabled_profile: d.enabledProfile ?? true,
        enabled_insight: d.enabledInsight ?? true,
        sort_order:      d.sortOrder ?? (i + 1) * 10,
      }));
      await db.from('dimensions_config').upsert(seeds, { onConflict: 'dim_key', ignoreDuplicates: true });
      _seeded = true;
      clearDimensionCache();
    } catch {
      // 表不存在 → 返回硬编码，不设置 _seeded，下次重试
      return NextResponse.json(PROFILE_DIMENSIONS.map((d, i) => ({
        key:            d.key,
        label:          d.label,
        isOrdered:      d.isOrdered,
        isMultiSelect:  d.isMultiSelect,
        orderedValues:  d.orderedValues,
        note:           d.note,
        fieldType:      d.isMultiSelect ? 'multi' : 'category',
        enabledProfile: true,
        enabledInsight: true,
        sortOrder:      (i + 1) * 10,
        chartType:      'bar',
        groupName:      '',
      })));
    }
  }

  const dims = await getDimensions(db);
  // 短时 CDN 缓存（30s），同时告知浏览器每次都验证（stale-while-revalidate）
  return NextResponse.json(dims, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}

// ── PUT: 批量更新维度配置（admin only）────────────────────────
export async function PUT(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const body = await req.json();
  const updates = body.dimensions as Array<{
    dim_key: string;
    label?: string;
    is_ordered?: boolean;
    is_multi_select?: boolean;
    ordered_values?: string[] | null;
    note?: string | null;
    field_type?: string;
    enabled_profile?: boolean;
    enabled_insight?: boolean;
    sort_order?: number;
    chart_type?: string;
    group_name?: string;
  }>;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: '缺少 dimensions 数组' }, { status: 400 });
  }

  const db = createServiceClient();

  for (const u of updates) {
    if (!u.dim_key) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertData: Record<string, any> = { dim_key: u.dim_key, updated_at: new Date().toISOString() };
    if (u.label !== undefined)           upsertData.label = u.label;
    if (u.is_ordered !== undefined)      upsertData.is_ordered = u.is_ordered;
    if (u.is_multi_select !== undefined) upsertData.is_multi_select = u.is_multi_select;
    if (u.ordered_values !== undefined)  upsertData.ordered_values = u.ordered_values;
    if (u.note !== undefined)            upsertData.note = u.note;
    if (u.field_type !== undefined)      upsertData.field_type = u.field_type;
    if (u.enabled_profile !== undefined) upsertData.enabled_profile = u.enabled_profile;
    if (u.enabled_insight !== undefined) upsertData.enabled_insight = u.enabled_insight;
    if (u.sort_order !== undefined)      upsertData.sort_order = u.sort_order;
    if (u.chart_type !== undefined)      upsertData.chart_type = u.chart_type;
    if (u.group_name !== undefined)      upsertData.group_name = u.group_name;

    await db.from('dimensions_config').upsert(upsertData, { onConflict: 'dim_key' });
  }

  clearDimensionCache();
  return NextResponse.json({ success: true });
}

// ── DELETE: 删除维度配置（admin only）────────────────────────
export async function DELETE(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const body = await req.json();
  const { dim_key } = body as { dim_key?: string };
  if (!dim_key) return NextResponse.json({ error: '缺少 dim_key' }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from('dimensions_config').delete().eq('dim_key', dim_key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  clearDimensionCache();
  return NextResponse.json({ success: true });
}
