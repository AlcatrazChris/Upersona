import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ── 进程内缓存：版本不变时直接返回，省去重复数据库查询 ──
// 在 Vercel serverless 环境中，同一实例内的多次请求可复用，跨实例则重新构建（可接受）
let _cache: { versionId: number; data: unknown } | null = null;

export async function GET() {
  const db = createServiceClient();

  // 先查活跃版本号（单行查询，极速）
  const { data: vd } = await db
    .from('data_versions')
    .select('version_id')
    .eq('is_active', true)
    .order('version_id', { ascending: false })
    .limit(1)
    .single();

  if (!vd) return NextResponse.json({ areas: [], totalSamples: 0 });

  // 命中缓存：相同版本直接返回，无需再查用户表
  if (_cache && _cache.versionId === vd.version_id) {
    return NextResponse.json(_cache.data);
  }

  // 仅拉取三列，limit 足够大以覆盖全量数据
  const { data, error } = await db
    .from('users')
    .select('region_area, region_province, region_city')
    .eq('data_version', vd.version_id)
    .limit(50000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── O(n) 单次遍历同时构建层级结构和计数 Map ──
  const areaMap:     Record<string, Record<string, Set<string>>> = {};
  const areaCounts:  Record<string, number> = {};
  const provCounts:  Record<string, number> = {};
  const cityCounts:  Record<string, number> = {};

  for (const u of data ?? []) {
    const { region_area: a, region_province: p, region_city: c } = u;

    // 层级结构
    if (!areaMap[a])    areaMap[a]    = {};
    if (!areaMap[a][p]) areaMap[a][p] = new Set();
    areaMap[a][p].add(c);

    // 计数
    areaCounts[a] = (areaCounts[a] || 0) + 1;
    provCounts[p] = (provCounts[p] || 0) + 1;
    cityCounts[c] = (cityCounts[c] || 0) + 1;
  }

  const areas = Object.keys(areaMap).sort().map(area => ({
    name:  area,
    count: areaCounts[area] || 0,
    provinces: Object.keys(areaMap[area]).sort().map(province => ({
      name:  province,
      count: provCounts[province] || 0,
      cities: Array.from(areaMap[area][province]).sort().map(city => ({
        name:  city,
        count: cityCounts[city] || 0,
      })),
    })),
  }));

  const result = { areas, totalSamples: data?.length ?? 0 };

  // 写入进程缓存
  _cache = { versionId: vd.version_id, data: result };

  return NextResponse.json(result);
}
