import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { getProfileDimensions } from '@/lib/dimensions';
import { countDimension, sortLabels } from '@/lib/sample-counter';

export const dynamic = 'force-dynamic';

const STATUS_GROUPS = [
  { key: '锁单/提车', values: ['已锁单', '订单完成'], color: '#34C759' },
  { key: '未锁单',   values: ['未锁单'],              color: '#FF9500' },
  { key: '退单',     values: ['退单'],                color: '#FF3B30' },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dim       = searchParams.get('dim');
  const area      = searchParams.get('area');
  const province  = searchParams.get('province');
  const city      = searchParams.get('city');
  const versionId = searchParams.get('versionId');

  if (!dim) return NextResponse.json({ error: '缺少参数 dim' }, { status: 400 });

  const db = createServiceClient();
  const allDims   = await getProfileDimensions(db);
  const dimConfig = allDims.find(d => d.key === dim);
  if (!dimConfig) return NextResponse.json({ error: '无效维度' }, { status: 400 });

  // 解析版本
  let resolvedVersionId: number;
  if (versionId) {
    const { data: hv } = await db.from('data_versions').select('version_id')
      .eq('version_id', parseInt(versionId, 10)).single();
    if (!hv) return NextResponse.json({ error: '指定版本不存在' }, { status: 404 });
    resolvedVersionId = hv.version_id;
  } else {
    const { data: vd } = await db.from('data_versions').select('version_id')
      .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
    if (!vd) return NextResponse.json({ error: '无活跃数据版本' }, { status: 404 });
    resolvedVersionId = vd.version_id;
  }

  const users = await fetchUsers(db, `${dim}, order_status`, q => {
    let r = q.eq('data_version', resolvedVersionId);
    if (city)          r = r.eq('region_city', city);
    else if (province) r = r.eq('region_province', province);
    else if (area)     r = r.eq('region_area', area);
    return r;
  });

  if (!users.length) return NextResponse.json({ error: '该筛选条件下无数据' }, { status: 404 });

  const { isOrdered, orderedValues, isMultiSelect } = dimConfig;

  // 全局计数（用于标签排序 + 每行 total）
  const globalCount = countDimension(users as Record<string, unknown>[], dim, isMultiSelect);
  const allLabels   = sortLabels(
    Object.keys(globalCount.counter), globalCount.counter,
    isOrdered, orderedValues
  );

  // 按订单状态分组
  const statusUserGroups = STATUS_GROUPS.map(sg => {
    const groupUsers = (users as Record<string, unknown>[]).filter(u =>
      sg.values.includes(String(u.order_status))
    );
    return { ...sg, users: groupUsers };
  });

  // 每组内用 countDimension 统计
  const groupCounts = statusUserGroups.map(sg =>
    countDimension(sg.users, dim, isMultiSelect)
  );

  // 生成结果行
  const rows = allLabels.map(label => ({
    label,
    total: globalCount.counter[label] || 0,
    statusCounts: statusUserGroups.map((sg, gi) => {
      const gc    = groupCounts[gi];
      const count = gc.counter[label] || 0;
      const denom = isMultiSelect ? gc.multiSelectDenom : gc.validUserCount;
      return {
        status:     sg.key,
        count,
        groupTotal: gc.validUserCount,
        pct: denom > 0 ? parseFloat((count / denom * 100).toFixed(1)) : 0,
      };
    }),
  }));

  // 全局统计（使用有效用户数）
  const validTotalUsers = groupCounts.reduce((s, gc) => s + gc.validUserCount, 0);
  const globalStatus = statusUserGroups.map((sg, gi) => ({
    status:     sg.key,
    count:      groupCounts[gi].validUserCount,
    totalCount: sg.users.length,
    pct: validTotalUsers > 0
      ? parseFloat((groupCounts[gi].validUserCount / validTotalUsers * 100).toFixed(1))
      : 0,
  }));

  return NextResponse.json({
    dimension:      dim,
    dimensionLabel: dimConfig.label,
    isMultiSelect:  dimConfig.isMultiSelect,
    allLabels,
    rows,
    totalSamples:  validTotalUsers,
    rawSamples:    users.length,
    globalStatus,
    statusGroups:  STATUS_GROUPS,
    filter:        { area, province, city },
    versionId:     resolvedVersionId,
    pctNote: isMultiSelect
      ? '各订单状态组内多选题各项占比，组内各项之和=100%'
      : '各订单状态组内该维度取值的占比，组内各项之和=100%',
  });
}
