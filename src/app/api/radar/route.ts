import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { calcRadarScores, RADAR_DIMENSION_META } from '@/lib/radarScoring';
import { makeCacheKey } from '@/lib/utils';
import type { OrderStatus } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type        = searchParams.get('type') || 'area';
  const name        = searchParams.get('name');
  const orderStatus = (searchParams.get('orderStatus') || 'all') as OrderStatus;

  if (!name) return NextResponse.json({ error: '缺少参数: name' }, { status: 400 });

  const db = createServiceClient();

  // 获取活跃版本
  const { data: vd } = await db.from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!vd) return NextResponse.json({ error: '无活跃数据版本' }, { status: 404 });

  const regionField = type === 'city' ? 'region_city'
    : type === 'province' ? 'region_province' : 'region_area';

  const SELECT_COLS = 'annual_income, education, family_structure, occupation_category, is_upgrade, order_status';

  // ── 查询地区数据 ──
  let regionQ = db.from('users').select(SELECT_COLS)
    .eq('data_version', vd.version_id).eq(regionField, name);
  if (orderStatus !== 'all') regionQ = regionQ.eq('order_status', orderStatus);
  const { data: regionUsers, error: rErr } = await regionQ;
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const regionScores = calcRadarScores(regionUsers || []);

  // ── 全国均值：先查缓存 ──
  const natCacheKey = makeCacheKey('national_radar', orderStatus, String(vd.version_id));
  let nationalScores: ReturnType<typeof calcRadarScores> | null = null;

  const { data: cached } = await db.from('insights_cache').select('content')
    .eq('cache_key', natCacheKey).single();

  if (cached) {
    try { nationalScores = JSON.parse(cached.content); } catch {}
  }

  // 没有缓存则实时计算并写入
  if (!nationalScores) {
    let natQ = db.from('users').select(SELECT_COLS).eq('data_version', vd.version_id);
    if (orderStatus !== 'all') natQ = natQ.eq('order_status', orderStatus);
    const { data: natUsers } = await natQ;
    nationalScores = calcRadarScores(natUsers || []);
    await db.from('insights_cache').upsert({
      cache_key: natCacheKey, insight_type: 'radar_national',
      content: JSON.stringify(nationalScores),
      data_version: vd.version_id, generated_at: new Date().toISOString(),
    }, { onConflict: 'cache_key' });
  }

  const dimensions = RADAR_DIMENSION_META.map(m => ({
    key:          m.key,
    label:        m.label,
    unit:         m.unit,
    score:        regionScores[m.key as keyof typeof regionScores] as number,
    nationalScore:nationalScores![m.key as keyof typeof nationalScores] as number,
    regionRaw:    regionScores[m.key as keyof typeof regionScores] as number,
    nationalRaw:  nationalScores![m.key as keyof typeof nationalScores] as number,
  }));

  return NextResponse.json({
    regionType: type, regionName: name,
    orderStatus, sampleCount: regionScores.count,
    dimensions, cached: !!cached,
  });
}
