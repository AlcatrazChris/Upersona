import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = createServiceClient();

  const { data: vd } = await db
    .from('data_versions').select('*')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();

  if (!vd) return NextResponse.json({
    total: 0, locked: 0, pending: 0, cancelled: 0,
    areaDistribution: [], version: null,
  });

  // ── 并行发起：3 条轻量 COUNT 查询 + 1 条区域明细查询 ──
  // HEAD 请求（count:'exact', head:true）只传输 Header，无行数据，极速
  const [totalRes, lockedRes, cancelledRes, areaRes] = await Promise.all([
    db.from('users').select('*', { count: 'exact', head: true })
      .eq('data_version', vd.version_id),
    db.from('users').select('*', { count: 'exact', head: true })
      .eq('data_version', vd.version_id)
      .in('order_status', ['已锁单', '订单完成']),
    db.from('users').select('*', { count: 'exact', head: true })
      .eq('data_version', vd.version_id)
      .eq('order_status', '退单'),
    // 区域明细：仅拉取两列，配合 O(n) Map 聚合
    db.from('users')
      .select('region_area, order_status')
      .eq('data_version', vd.version_id)
      .limit(50000),     // 足够大的 limit，避免截断
  ]);

  const total     = totalRes.count     ?? 0;
  const locked    = lockedRes.count    ?? 0;
  const cancelled = cancelledRes.count ?? 0;
  const pending   = total - locked - cancelled;

  // ── O(n) Map 聚合区域分布 ──
  type AreaStat = { total: number; locked: number; pending: number; cancelled: number };
  const areaMap: Record<string, AreaStat> = {};

  for (const u of (areaRes.data ?? []) as { order_status: string; region_area: string }[]) {
    const a = u.region_area || '未知';
    if (!areaMap[a]) areaMap[a] = { total: 0, locked: 0, pending: 0, cancelled: 0 };
    areaMap[a].total++;
    if (u.order_status === '已锁单' || u.order_status === '订单完成') areaMap[a].locked++;
    else if (u.order_status === '退单') areaMap[a].cancelled++;
    else areaMap[a].pending++;
  }

  const areaDistribution = Object.entries(areaMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([area, counts]) => ({
      area,
      ...counts,
      lockedPct:    total > 0 ? (counts.locked    / total * 100).toFixed(1) : '0',
      pendingPct:   total > 0 ? (counts.pending   / total * 100).toFixed(1) : '0',
      cancelledPct: total > 0 ? (counts.cancelled / total * 100).toFixed(1) : '0',
    }));

  return NextResponse.json({
    total,
    locked,
    pending,
    cancelled,
    lockedRate:    total > 0 ? (locked    / total * 100).toFixed(1) : '0',
    cancelledRate: total > 0 ? (cancelled / total * 100).toFixed(1) : '0',
    areaDistribution,
    version: vd,
  });
}
