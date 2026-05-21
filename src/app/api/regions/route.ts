import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = createServiceClient();

  const { data, error } = await db
    .from('active_users')
    .select('region_area, region_province, region_city');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 构建层级结构
  const areaMap: Record<string, Record<string, Set<string>>> = {};

  for (const u of data || []) {
    if (!areaMap[u.region_area]) areaMap[u.region_area] = {};
    if (!areaMap[u.region_area][u.region_province]) {
      areaMap[u.region_area][u.region_province] = new Set();
    }
    areaMap[u.region_area][u.region_province].add(u.region_city);
  }

  // 统计各地区样本数
  const areaCounts: Record<string, number> = {};
  const provinceCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};

  for (const u of data || []) {
    areaCounts[u.region_area] = (areaCounts[u.region_area] || 0) + 1;
    provinceCounts[u.region_province] = (provinceCounts[u.region_province] || 0) + 1;
    cityCounts[u.region_city] = (cityCounts[u.region_city] || 0) + 1;
  }

  const areas = Object.keys(areaMap).sort().map(area => ({
    name: area,
    count: areaCounts[area] || 0,
    provinces: Object.keys(areaMap[area]).sort().map(province => ({
      name: province,
      count: provinceCounts[province] || 0,
      cities: Array.from(areaMap[area][province]).sort().map(city => ({
        name: city,
        count: cityCounts[city] || 0,
      })),
    })),
  }));

  return NextResponse.json({ areas, totalSamples: data?.length || 0 });
}
