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
  const dim       = searchParams.get('dim');
  const area      = searchParams.get('area');
  const province  = searchParams.get('province');
  const city      = searchParams.get('city');
  const versionId = searchParams.get('versionId'); // 可选：指定历史版本 ID

  if (!dim) return NextResponse.json({ error: '缺少参数 dim' }, { status: 400 });
  const dimConfig = PROFILE_DIMENSIONS.find(d => d.key === dim);
  if (!dimConfig) return NextResponse.json({ error: '无效维度' }, { status: 400 });

  const db = createServiceClient();

  let resolvedVersionId: number;
  if (versionId) {
    // 使用指定历史版本
    const { data: hv } = await db.from('data_versions').select('version_id')
      .eq('version_id', parseInt(versionId, 10)).single();
    if (!hv) return NextResponse.json({ error: '指定版本不存在' }, { status: 404 });
    resolvedVersionId = hv.version_id;
  } else {
    // 使用当前活跃版本
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

  // ── 单次遍历收集标签集合与全局计数 Map（O(n)，取代 O(n²) filter 嵌套）──
  const labelSet      = new Set<string>();
  const totalCountMap: Record<string, number> = {};

  for (const u of users as Record<string, unknown>[]) {
    const val = u[dim];
    if (isMultiSelect && Array.isArray(val)) {
      for (const v of val as string[]) {
        if (v && v !== '(跳过)') {
          labelSet.add(v);
          totalCountMap[v] = (totalCountMap[v] || 0) + 1;
        }
      }
    } else {
      const v = String(val || '').trim();
      if (v && v !== '(跳过)') {
        labelSet.add(v);
        totalCountMap[v] = (totalCountMap[v] || 0) + 1;
      }
    }
  }

  let allLabels = Array.from(labelSet);
  if (isOrdered && orderedValues) {
    const orderMap = Object.fromEntries(orderedValues.map((v, i) => [v, i]));
    allLabels.sort((a, b) => (orderMap[a] ?? 999) - (orderMap[b] ?? 999));
  } else {
    // 直接用 O(1) Map 查询，不再调用 filter()
    allLabels.sort((a, b) => (totalCountMap[b] || 0) - (totalCountMap[a] || 0));
  }

  // ── 列内百分比：按订单状态分组 ──
  const statusUserGroups = STATUS_GROUPS.map(sg => {
    const groupUsers = (users as Record<string, unknown>[]).filter(u =>
      sg.values.includes(String(u.order_status))
    );
    return { ...sg, users: groupUsers, total: groupUsers.length };
  });

  // ── 预建每个订单状态组的计数 Map ────────────────────────────────
  // validCount = 组内有非空值的用户数（单选题分母，排除空白）
  // multiSelectDenom = 组内所有有效选项总数（多选题分母）
  interface GroupMap {
    map:              Record<string, number>;
    multiSelectDenom: number;
    validCount:       number;  // 排除空白后的有效用户数
    total:            number;  // 原始用户总数（保留用于 UI 层显示）
  }

  const groupMaps: GroupMap[] = statusUserGroups.map(sg => {
    const map: Record<string, number> = {};
    let multiSelectDenom = 0;
    let validCount = 0;
    for (const u of sg.users) {
      const val = u[dim];
      if (isMultiSelect && Array.isArray(val)) {
        let hasValid = false;
        for (const v of val as string[]) {
          if (v && v !== '(跳过)') {
            map[v] = (map[v] || 0) + 1;
            multiSelectDenom++;
            hasValid = true;
          }
        }
        if (hasValid) validCount++;
      } else {
        const v = String(val || '').trim();
        if (v && v !== '(跳过)') {
          map[v] = (map[v] || 0) + 1;
          validCount++;
        }
      }
    }
    return { map, multiSelectDenom, validCount, total: sg.total };
  });

  // ── 生成结果行 ────────────────────────────────────────────────
  // 使用有效用户数（排除空白）作为分母，保证百分比准确
  const rows = allLabels.map(label => {
    const statusCounts = statusUserGroups.map((sg, gi) => {
      const gm    = groupMaps[gi];
      const count = gm.map[label] || 0;
      const denom = isMultiSelect ? gm.multiSelectDenom : gm.validCount;
      return {
        status:     sg.key,
        count,
        groupTotal: gm.validCount,   // 有效总数（不含空白）
        pct: denom > 0 ? parseFloat((count / denom * 100).toFixed(1)) : 0,
      };
    });

    return { label, total: totalCountMap[label] || 0, statusCounts };
  });

  // ── 全局统计（使用有效用户数）────────────────────────────────
  // validTotalUsers = 有非空维度值的用户总数
  const validTotalUsers = groupMaps.reduce((s, gm) => s + gm.validCount, 0);
  const totalUsers      = users.length;
  const globalStatus = statusUserGroups.map((sg, gi) => ({
    status:     sg.key,
    count:      groupMaps[gi].validCount,       // 有效用户数（排除空白）
    totalCount: sg.total,                        // 原始总数（含空白，供参考）
    pct: validTotalUsers > 0
      ? parseFloat((groupMaps[gi].validCount / validTotalUsers * 100).toFixed(1))
      : 0,
  }));

  return NextResponse.json({
    dimension:      dim,
    dimensionLabel: dimConfig.label,
    isMultiSelect:  dimConfig.isMultiSelect,
    allLabels,
    rows,
    totalSamples:  validTotalUsers,   // 有效样本数（排除空白）
    rawSamples:    totalUsers,         // 原始总数（含空白）
    globalStatus,
    statusGroups:  STATUS_GROUPS,
    filter:        { area, province, city },
    versionId:     resolvedVersionId,
    pctNote: isMultiSelect
      ? '各订单状态组内多选题各项占比，组内各项之和=100%'
      : '各订单状态组内该维度取值的占比，组内各项之和=100%',
  });
}
