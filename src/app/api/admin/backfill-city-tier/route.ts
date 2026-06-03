/**
 * POST /api/admin/backfill-city-tier
 *
 * 为当前活跃版本中 city_tier 为空的用户记录，
 * 根据 region_city 自动计算并回填城市级别。
 *
 * 如果 city_tier 列不存在，提示用户先执行 add_city_tier.sql。
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';
import { getCityTier } from '@/lib/city-tiers';

export const dynamic  = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const db = createServiceClient();

  // ── 1. 检测 city_tier 列是否存在 ──────────────────────────────
  const { error: colErr } = await db.from('users').select('city_tier').limit(0);
  if (colErr) {
    // 列不存在（PostgREST 返回 PGRST204 / 400）
    return NextResponse.json({
      error: 'city_tier 列不存在，请先在 Supabase SQL Editor 执行 supabase/add_city_tier.sql',
      hint: '执行后再点击此按钮即可自动补充所有记录的城市级别',
    }, { status: 400 });
  }

  // ── 2. 获取当前活跃版本 ────────────────────────────────────────
  const { data: vd } = await db.from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!vd) return NextResponse.json({ error: '无活跃数据版本' }, { status: 404 });

  // ── 3. 拉取所有 city_tier 为空且有城市信息的用户（分页避免超限）─
  type UserRow = { id: number; region_city: string };
  const PAGE = 1000;
  const toUpdate: UserRow[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await db
      .from('users')
      .select('id, region_city')
      .eq('data_version', vd.version_id)
      .or('city_tier.is.null,city_tier.eq.')   // city_tier 为空或空字符串
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    toUpdate.push(...(data as UserRow[]));
    if (data.length < PAGE) break;
    page++;
  }

  if (toUpdate.length === 0) {
    return NextResponse.json({ success: true, updated: 0, message: '所有记录的城市级别已是最新，无需更新' });
  }

  // ── 4. 按城市分组，批量 UPDATE（减少请求数）───────────────────
  const cityGroups = new Map<string, number[]>(); // city → [id, ...]
  for (const u of toUpdate) {
    const c = u.region_city || '';
    if (!cityGroups.has(c)) cityGroups.set(c, []);
    cityGroups.get(c)!.push(u.id);
  }

  let updatedCount = 0;
  for (const [city, ids] of cityGroups) {
    const tier = getCityTier(city);
    // 分批更新（Supabase IN 限制约 1000）
    const BATCH = 500;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batchIds = ids.slice(i, i + BATCH);
      const { error: upErr } = await db.from('users')
        .update({ city_tier: tier })
        .in('id', batchIds);
      if (!upErr) updatedCount += batchIds.length;
    }
  }

  return NextResponse.json({
    success: true,
    updated: updatedCount,
    uniqueCities: cityGroups.size,
    message: `已为 ${updatedCount} 条记录补充城市级别（涉及 ${cityGroups.size} 个城市）`,
  });
}
