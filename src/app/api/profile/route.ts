import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { getProfileDimensions, getDimensionColumns } from '@/lib/dimensions';
import { countDimension, calcPercentage, sortLabels } from '@/lib/sample-counter';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const area        = searchParams.get('area');
  const province    = searchParams.get('province');
  const city        = searchParams.get('city');
  const dim         = searchParams.get('dim');
  const orderStatus = searchParams.get('orderStatus');

  const db = createServiceClient();

  const { data: versionData } = await db
    .from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!versionData) return NextResponse.json({ dimensions: [], totalSamples: 0 });

  // 动态加载维度配置
  const allDims = await getProfileDimensions(db);
  const dims    = dim ? allDims.filter(d => d.key === dim) : allDims;

  // 动态构建列列表（自动包含 order_status）
  const COLS = getDimensionColumns(allDims, ['order_status']);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilter = (q: any): any => {
    let r = q.eq('data_version', versionData.version_id);
    if (city)          r = r.eq('region_city', city);
    else if (province) r = r.eq('region_province', province);
    else if (area)     r = r.eq('region_area', area);
    if (orderStatus && orderStatus !== 'all')
      r = orderStatus === '锁单/提车'
        ? r.in('order_status', ['已锁单', '订单完成'])
        : r.eq('order_status', orderStatus);
    return r;
  };

  let users;
  try {
    users = await fetchUsers(db, COLS, applyFilter);
  } catch (e) {
    // 某列不存在时降级（移除失败列重试）
    try {
      users = await fetchUsers(db, getDimensionColumns(dims, ['order_status']), applyFilter);
    } catch {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }
  if (!users || users.length === 0) return NextResponse.json({ dimensions: [], totalSamples: 0 });

  // 使用统一 countDimension 计算每个维度
  const results = dims.map(config => {
    const { key, label, isOrdered, isMultiSelect, orderedValues, note, chartType, groupName } = config;
    const dimKey = key as string;

    const cr = countDimension(users as Record<string, unknown>[], dimKey, isMultiSelect);
    const sortedLabels = sortLabels(Object.keys(cr.counter), cr.counter, isOrdered, orderedValues);

    const items = sortedLabels.map(lbl => ({
      label: lbl,
      count: cr.counter[lbl] || 0,
      percentage: calcPercentage(cr.counter[lbl] || 0, cr, isMultiSelect),
    }));

    return {
      dimension: key,
      dimensionLabel: label,
      items,
      totalSamples:  cr.validUserCount,
      validSamples:  cr.validUserCount,
      isMultiSelect,
      note: isMultiSelect
        ? (note ? note.replace('总和 > 100%', '各项之和 = 100%') : '各项之和 = 100%')
        : note,
      chartType: chartType || 'bar',
      groupName: groupName || '',
    };
  });

  // 总样本数 = 至少一个维度有非空值的用户数
  const totalSamples = (users as Record<string, unknown>[]).filter(user =>
    dims.some(config => {
      const raw = user[config.key as string];
      if (config.isMultiSelect && Array.isArray(raw)) {
        return (raw as string[]).some(v => v && v.trim() && v !== '(跳过)');
      }
      const v = String(raw ?? '').trim();
      return v !== '' && v !== '(跳过)';
    })
  ).length;

  return NextResponse.json({ dimensions: results, totalSamples, filter: { area, province, city, orderStatus } });
}
