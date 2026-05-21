import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { generateCompareInsight } from '@/lib/deepseek';
import { PROFILE_DIMENSIONS } from '@/types';
import { makeCacheKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const regionsParam = searchParams.get('regions');
  const regionType   = searchParams.get('type') || 'area';
  const dimension    = searchParams.get('dim');
  const noCache      = searchParams.get('noCache') === '1';
  const orderStatus  = searchParams.get('orderStatus');

  if (!regionsParam || !dimension) {
    return NextResponse.json({ error: '缺少参数: regions, dim' }, { status: 400 });
  }

  const regions = regionsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (regions.length < 2 || regions.length > 12) {
    return NextResponse.json({ error: '请选择 2-12 个地区' }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: versionData } = await db
    .from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!versionData) return NextResponse.json({ error: '无活跃数据版本' }, { status: 404 });

  const dimConfig = PROFILE_DIMENSIONS.find(d => d.key === dimension);
  if (!dimConfig) return NextResponse.json({ error: '无效维度' }, { status: 400 });

  const { isOrdered, isMultiSelect, orderedValues, label: dimLabel } = dimConfig;
  const regionField = regionType === 'city' ? 'region_city'
    : regionType === 'province' ? 'region_province' : 'region_area';

  let query = db.from('users')
    .select(`${regionField}, ${dimension}`)
    .eq('data_version', versionData.version_id)
    .in(regionField, regions);
  if (orderStatus && orderStatus !== 'all') query = query.eq('order_status', orderStatus);

  const { data: users, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const regionData: Record<string, { count: number; counter: Record<string, number> }> = {};
  for (const region of regions) regionData[region] = { count: 0, counter: {} };

  for (const user of users || []) {
    const reg = (user as unknown as Record<string, string>)[regionField];
    if (!regionData[reg]) continue;
    regionData[reg].count++;
    const rawVal = (user as unknown as Record<string, string | string[]>)[dimension];
    if (isMultiSelect && Array.isArray(rawVal)) {
      for (const v of rawVal) {
        if (!v || v === '(跳过)') continue;
        regionData[reg].counter[v] = (regionData[reg].counter[v] || 0) + 1;
      }
    } else {
      const v = String(rawVal || '').trim();
      if (!v || v === '(跳过)') continue;
      regionData[reg].counter[v] = (regionData[reg].counter[v] || 0) + 1;
    }
  }

  const allLabelsSet = new Set<string>();
  for (const rd of Object.values(regionData)) Object.keys(rd.counter).forEach(k => allLabelsSet.add(k));
  let allLabels = Array.from(allLabelsSet);

  if (isOrdered && orderedValues) {
    // orderedValues 在 types 里是大→小（50岁以上 ... 30岁以下）
    // 堆积图：先渲染的 Bar 在底部，所以需要反转——小值先（底部），大值后（顶部）
    // 即按 orderedValues 逆序排列
    const orderMap = Object.fromEntries(orderedValues.map((v, i) => [v, i]));
    // 降序：index 大（值小）→ 先排；index 小（值大）→ 后排 → 大值在顶部
    allLabels.sort((a, b) => (orderMap[b] ?? -1) - (orderMap[a] ?? -1));
  } else {
    const totalCounter: Record<string, number> = {};
    for (const rd of Object.values(regionData)) {
      for (const [k, v] of Object.entries(rd.counter)) totalCounter[k] = (totalCounter[k] || 0) + v;
    }
    allLabels.sort((a, b) => (totalCounter[a] || 0) - (totalCounter[b] || 0));
  }

  const compareRegions = regions.map(reg => {
    const rd = regionData[reg];
    const n = rd.count;
    const multiTotal = isMultiSelect
      ? Object.values(rd.counter).reduce((s, c) => s + c, 0)
      : n;
    const distribution = allLabels.map(lbl => ({
      label: lbl,
      count: rd.counter[lbl] || 0,
      percentage: (isMultiSelect ? multiTotal : n) > 0
        ? parseFloat(((rd.counter[lbl] || 0) / (isMultiSelect ? multiTotal : n) * 100).toFixed(1))
        : 0,
    }));
    return { region: reg, sampleCount: n, distribution };
  });

  const cacheKey = makeCacheKey('compare', regionType, [...regions].sort().join(','), dimension, orderStatus || 'all');
  let insight: string | null = null;
  let insightCached = false;

  if (!noCache) {
    const { data: cached } = await db.from('insights_cache').select('content').eq('cache_key', cacheKey).single();
    if (cached) { insight = cached.content; insightCached = true; }
  }

  if (!insight) {
    try {
      insight = await generateCompareInsight({
        dimension, dimensionLabel: dimLabel, orderStatus: orderStatus || 'all',
        regions: compareRegions.map(r => ({ name: r.region, sampleCount: r.sampleCount, distribution: r.distribution.slice(0, 5) })),
      });
      await db.from('insights_cache').upsert({
        cache_key: cacheKey, insight_type: 'compare', content: insight,
        data_version: versionData.version_id, generated_at: new Date().toISOString(),
      }, { onConflict: 'cache_key' });
    } catch (err) { console.error('生成洞察失败:', err); }
  }

  return NextResponse.json({ dimension, dimensionLabel: dimLabel, regions: compareRegions, allLabels, insight, insightCached });
}
