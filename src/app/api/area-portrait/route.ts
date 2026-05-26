import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { PROFILE_DIMENSIONS } from '@/types';

export const dynamic = 'force-dynamic';

const ANALYSIS_DIMS = [
  { key: 'age_group',           label: '年龄段' },
  { key: 'education',           label: '学历' },
  { key: 'occupation_category', label: '职业' },
  { key: 'family_structure',    label: '家庭结构' },
  { key: 'annual_income',       label: '家庭年收入' },
  { key: 'is_upgrade',          label: '增换购' },
  { key: 'info_channels',       label: '了解渠道' },
  { key: 'consumption_views',   label: '消费观念' },
  { key: 'competing_models',    label: '对比车型' },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderStatus  = searchParams.get('orderStatus') || 'all';
  const regionType   = (searchParams.get('regionType') || 'area') as 'area' | 'province' | 'city';
  const regionsParam = searchParams.get('regions'); // 逗号分隔，最多12个；为空则取全部
  const listOnly     = searchParams.get('listOnly') === '1'; // 只返回可选列表

  const db = createServiceClient();
  const { data: vd } = await db.from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!vd) return NextResponse.json({ error: '无活跃数据版本' }, { status: 404 });

  const regionField = regionType === 'city' ? 'region_city'
    : regionType === 'province' ? 'region_province'
    : 'region_area';

  const cols = ['region_area', 'region_province', 'region_city',
    ...ANALYSIS_DIMS.map(d => d.key),
  ].join(', ');

  const selectedRegions = regionsParam
    ? regionsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12)
    : null;

  const users = await fetchUsers(db, cols, q => {
    let r = q.eq('data_version', vd.version_id);
    if (orderStatus === '锁单/提车') r = r.in('order_status', ['已锁单', '订单完成']);
    else if (orderStatus !== 'all')  r = r.eq('order_status', orderStatus);
    if (selectedRegions?.length) r = r.in(regionField, selectedRegions);
    return r;
  });

  if (!users.length) return NextResponse.json({ error: '无数据' }, { status: 404 });

  // listOnly 模式：只返回可选地域列表，快速响应
  if (listOnly) {
    const allAreas = [...new Set(users.map((u: Record<string, unknown>) => String(u[regionField])))].sort();
    return NextResponse.json({ allAvailableAreas: allAreas });
  }

  // 全量数据（用于计算全国偏差基准，不受地域筛选影响）
  const allUsers = selectedRegions?.length
    ? await fetchUsers(db, cols, q => {
        let r = q.eq('data_version', vd.version_id);
        if (orderStatus === '锁单/提车') r = r.in('order_status', ['已锁单', '订单完成']);
        else if (orderStatus !== 'all')  r = r.eq('order_status', orderStatus);
        return r;
      })
    : users;

  // 获取地域列表（保持选择顺序）
  const areas = selectedRegions?.length
    ? selectedRegions
    : [...new Set(users.map((u: Record<string, unknown>) => String(u[regionField])))].sort();

  function getTopN(group: Record<string, unknown>[], dimKey: string, n = 3) {
    const dimConf = PROFILE_DIMENSIONS.find(d => d.key === dimKey);
    const counter: Record<string, number> = {};
    const total = group.length;
    for (const u of group) {
      const val = u[dimKey];
      if (dimConf?.isMultiSelect && Array.isArray(val)) {
        (val as string[]).forEach(v => { if (v && v !== '(跳过)') counter[v] = (counter[v] || 0) + 1; });
      } else {
        const v = String(val || '').trim();
        if (v && v !== '(跳过)') counter[v] = (counter[v] || 0) + 1;
      }
    }
    const denom = dimConf?.isMultiSelect
      ? Object.values(counter).reduce((s, c) => s + c, 0)
      : total;
    return Object.entries(counter)
      .map(([label, count]) => ({
        label, count,
        pct: denom > 0 ? Math.round(count / denom * 100) : 0,  // 直接整数
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  // 基准 top：
  // - 无地域筛选：用全量数据作为"全国"基准
  // - 有地域筛选：用所有选定地域合并的数据作为"选定均值"基准
  const baselineUsers = selectedRegions?.length ? users : allUsers;
  const baselineLabel = selectedRegions?.length ? '选定均值' : '全国';
  const nationalTops: Record<string, { label: string; pct: number }[]> = {};
  for (const dim of ANALYSIS_DIMS) {
    nationalTops[dim.key] = getTopN(baselineUsers as Record<string, unknown>[], dim.key, 3);
  }

  // 各地域统计
  const areaStats = areas.map(area => {
    const areaUsers = users.filter((u: Record<string, unknown>) => String(u[regionField]) === area);
    const dims: Record<string, { label: string; pct: number; diff: number }[]> = {};
    for (const dim of ANALYSIS_DIMS) {
      const topItems = getTopN(areaUsers, dim.key, dim.key === 'occupation_category' ? 4 : 3);
      dims[dim.key] = topItems.map(item => {
        const nat = nationalTops[dim.key].find(n => n.label === item.label);
        const natPct = nat ? nat.pct : Math.round(
          (nationalTops[dim.key][0]?.pct ?? 0) * 0.5  // 未在全国TOP3中时，差值估算
        );
        return { ...item, diff: Math.round(item.pct - natPct) };
      });
    }
    return { area, n: areaUsers.length, dims };
  });

  // 可用地域列表（供前端展示选择）
  const allAvailableAreas = [...new Set(
    (selectedRegions?.length ? allUsers : users)
      .map((u: Record<string, unknown>) => String(u[regionField]))
  )].sort();

  return NextResponse.json({
    areas, areaStats, nationalTops,
    dims: ANALYSIS_DIMS,
    totalSamples: users.length,
    regionType,
    allAvailableAreas,
    baselineLabel,   // '全国' 或 '选定均值'
  });
}
