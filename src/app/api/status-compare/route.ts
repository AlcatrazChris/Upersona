import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { PROFILE_DIMENSIONS } from '@/types';

export const dynamic = 'force-dynamic';

const STATUS_GROUPS = [
  { key: '锁单/提车', values: ['已锁单', '订单完成'], color: '#34C759' },
  { key: '未锁单',   values: ['未锁单'],              color: '#FF9500' },
  { key: '退单',     values: ['退单'],                color: '#FF3B30' },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dim      = searchParams.get('dim');
  const area     = searchParams.get('area');
  const province = searchParams.get('province');
  const city     = searchParams.get('city');

  if (!dim) return NextResponse.json({ error: '缺少参数 dim' }, { status: 400 });
  const dimConfig = PROFILE_DIMENSIONS.find(d => d.key === dim);
  if (!dimConfig) return NextResponse.json({ error: '无效维度' }, { status: 400 });

  const db = createServiceClient();
  const { data: vd } = await db.from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!vd) return NextResponse.json({ error: '无活跃数据版本' }, { status: 404 });

  const users = await fetchUsers(db, `${dim}, order_status`, q => {
    let r = q.eq('data_version', vd.version_id);
    if (city)          r = r.eq('region_city', city);
    else if (province) r = r.eq('region_province', province);
    else if (area)     r = r.eq('region_area', area);
    return r;
  });

  if (!users.length) return NextResponse.json({ error: '该筛选条件下无数据' }, { status: 404 });

  const { isOrdered, orderedValues, isMultiSelect } = dimConfig;

  // 收集所有维度标签
  const labelSet = new Set<string>();
  for (const u of users) {
    const val = u[dim];
    if (isMultiSelect && Array.isArray(val)) {
      (val as string[]).forEach(v => v && v !== '(跳过)' && labelSet.add(v));
    } else {
      const v = String(val || '').trim();
      if (v && v !== '(跳过)') labelSet.add(v);
    }
  }

  let allLabels = Array.from(labelSet);
  if (isOrdered && orderedValues) {
    const orderMap = Object.fromEntries(orderedValues.map((v, i) => [v, i]));
    allLabels.sort((a, b) => (orderMap[a] ?? 999) - (orderMap[b] ?? 999));
  } else {
    const totalCount: Record<string, number> = {};
    for (const label of allLabels) {
      totalCount[label] = users.filter((u: Record<string, unknown>) => {
        const val = u[dim];
        return isMultiSelect && Array.isArray(val)
          ? (val as string[]).includes(label)
          : String(val || '').trim() === label;
      }).length;
    }
    allLabels.sort((a, b) => (totalCount[b] || 0) - (totalCount[a] || 0));
  }

  // ── 核心修改：列内百分比（每个订单状态内，各维度取值各占多少） ──
  //
  // 先按订单状态分组，得到三组用户
  // 再在每组内统计各维度取值的分布
  // 这样"锁单/提车"组加起来=100%，"退单"组加起来=100%（多选题除外）

  const statusUserGroups = STATUS_GROUPS.map(sg => {
    const groupUsers = users.filter((u: Record<string, unknown>) =>
      sg.values.includes(String(u.order_status))
    );
    return { ...sg, users: groupUsers, total: groupUsers.length };
  });

  // 对每个维度标签，统计它在各订单状态组内的占比
  const rows = allLabels.map(label => {
    const statusCounts = statusUserGroups.map(sg => {
      // 在这个订单状态组内，包含此维度标签的用户数
      const count = sg.users.filter((u: Record<string, unknown>) => {
        const val = u[dim];
        return isMultiSelect && Array.isArray(val)
          ? (val as string[]).includes(label)
          : String(val || '').trim() === label;
      }).length;

      // 多选题：分母 = 该订单状态组的所有选项计数之和
      // 单选题：分母 = 该订单状态组的用户总数
      let denominator = sg.total;
      if (isMultiSelect) {
        denominator = sg.users.reduce((sum: number, u: Record<string, unknown>) => {
          const val = u[dim];
          return sum + (Array.isArray(val) ? (val as string[]).filter(v => v && v !== '(跳过)').length : 0);
        }, 0);
      }

      return {
        status: sg.key,
        count,
        groupTotal: sg.total,
        pct: denominator > 0 ? parseFloat((count / denominator * 100).toFixed(1)) : 0,
      };
    });

    // 同时保留行内总计（用于显示样本量）
    const totalInDim = users.filter((u: Record<string, unknown>) => {
      const val = u[dim];
      return isMultiSelect && Array.isArray(val)
        ? (val as string[]).includes(label)
        : String(val || '').trim() === label;
    }).length;

    return { label, total: totalInDim, statusCounts };
  });

  // 全局统计
  const globalStatus = statusUserGroups.map(sg => ({
    status: sg.key,
    count: sg.total,
    pct: parseFloat((sg.total / users.length * 100).toFixed(1)),
  }));

  return NextResponse.json({
    dimension: dim,
    dimensionLabel: dimConfig.label,
    isMultiSelect: dimConfig.isMultiSelect,
    allLabels,
    rows,
    totalSamples: users.length,
    globalStatus,
    statusGroups: STATUS_GROUPS,
    filter: { area, province, city },
    // 告诉前端百分比的含义
    pctNote: isMultiSelect
      ? '各订单状态组内多选题各项占比，组内各项之和=100%'
      : '各订单状态组内该维度取值的占比，组内各项之和=100%',
  });
}
