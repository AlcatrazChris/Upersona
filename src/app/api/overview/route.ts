import { NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';

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

  const rows = await fetchUsers(db, 'order_status, region_area',
    q => q.eq('data_version', vd.version_id)
  );

  const total     = rows.length;
  const locked    = rows.filter((u: { order_status: string }) =>
    u.order_status === '已锁单' || u.order_status === '订单完成').length;
  const cancelled = rows.filter((u: { order_status: string }) =>
    u.order_status === '退单').length;
  const pending   = total - locked - cancelled;

  const areaMap: Record<string, { total: number; locked: number; pending: number; cancelled: number }> = {};
  for (const u of rows as { order_status: string; region_area: string }[]) {
    if (!areaMap[u.region_area]) areaMap[u.region_area] = { total: 0, locked: 0, pending: 0, cancelled: 0 };
    areaMap[u.region_area].total++;
    if (u.order_status === '已锁单' || u.order_status === '订单完成') areaMap[u.region_area].locked++;
    else if (u.order_status === '退单') areaMap[u.region_area].cancelled++;
    else areaMap[u.region_area].pending++;
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
