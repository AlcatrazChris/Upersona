/**
 * GET /api/version-compare
 * 返回两个版本的核心指标对比数据，用于"洞察版本对比"功能
 *
 * ?type=area|province|city&name=地区名&orderStatus=all|...
 * &versionA=当前版本ID&versionB=对比版本ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import type { OrderStatus } from '@/types';

export const dynamic = 'force-dynamic';

// 简化统计：TopN 各维度分布
function topN(
  users: Record<string, unknown>[],
  key: string,
  isMulti: boolean,
  n: number
): { label: string; pct: number }[] {
  const total = users.length;
  if (total === 0) return [];
  const cnt: Record<string, number> = {};
  for (const u of users) {
    const raw = u[key];
    const vals = isMulti && Array.isArray(raw) ? (raw as string[]) : [String(raw || '')];
    for (const v of vals) {
      if (v && v !== '(跳过)') cnt[v] = (cnt[v] || 0) + 1;
    }
  }
  return Object.entries(cnt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, pct: parseFloat((count / total * 100).toFixed(1)) }));
}

interface VersionSnapshot {
  versionId: number;
  sampleCount: number;
  strongCount: number;
  strongRatio: number;
  dims: Record<string, { label: string; pct: number }[]>;
}

async function fetchSnapshot(
  db: ReturnType<typeof createServiceClient>,
  versionId: number,
  regionField: string,
  regionName: string,
  orderStatus: OrderStatus
): Promise<VersionSnapshot> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilter = (q: any): any => {
    let r = q.eq('data_version', versionId).eq(regionField, regionName);
    if (orderStatus !== 'all')
      r = orderStatus === '锁单/提车'
        ? r.in('order_status', ['已锁单', '订单完成'])
        : r.eq('order_status', orderStatus);
    return r;
  };

  // 先尝试含 city_tier 的 SELECT，若字段不存在则降级
  const BASE_SELECT = 'intent_label,order_status,age_group,education,occupation_category,annual_income,family_structure,is_upgrade';
  let users: Awaited<ReturnType<typeof fetchUsers>>;
  let hasCityTier = true;
  try {
    users = await fetchUsers(db, BASE_SELECT + ',city_tier', applyFilter);
  } catch {
    // city_tier 列不存在时降级
    hasCityTier = false;
    users = await fetchUsers(db, BASE_SELECT, applyFilter);
  }

  const total  = users.length;
  const strong = users.filter(u => u.intent_label === 1).length;

  const COMPARE_DIMS: { key: string; isMulti: boolean }[] = [
    { key: 'age_group',           isMulti: false },
    { key: 'education',           isMulti: false },
    { key: 'occupation_category', isMulti: false },
    { key: 'annual_income',       isMulti: false },
    { key: 'family_structure',    isMulti: false },
    { key: 'is_upgrade',          isMulti: false },
    ...(hasCityTier ? [{ key: 'city_tier', isMulti: false }] : []),
  ];

  const dims: Record<string, { label: string; pct: number }[]> = {};
  for (const d of COMPARE_DIMS) {
    dims[d.key] = topN(users as Record<string, unknown>[], d.key, d.isMulti, 3);
  }

  return {
    versionId,
    sampleCount: total,
    strongCount: strong,
    strongRatio: total > 0 ? parseFloat((strong / total * 100).toFixed(1)) : 0,
    dims,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type        = searchParams.get('type') || 'area';
  const name        = searchParams.get('name') || '';
  const orderStatus = (searchParams.get('orderStatus') || 'all') as OrderStatus;
  const versionA    = parseInt(searchParams.get('versionA') || '0', 10);
  const versionB    = parseInt(searchParams.get('versionB') || '0', 10);

  if (!name) return NextResponse.json({ error: '缺少地区名' }, { status: 400 });
  if (!versionA || !versionB) return NextResponse.json({ error: '需要 versionA 和 versionB' }, { status: 400 });

  const db = createServiceClient();

  // 获取版本列表以确认存在
  const { data: versions } = await db
    .from('data_versions')
    .select('version_id, uploaded_at, record_count')
    .in('version_id', [versionA, versionB]);

  const vMap = Object.fromEntries((versions || []).map(v => [v.version_id, v]));
  if (!vMap[versionA] || !vMap[versionB]) {
    return NextResponse.json({ error: '版本不存在' }, { status: 404 });
  }

  const regionField = type === 'city' ? 'region_city' : type === 'province' ? 'region_province' : 'region_area';

  const [snapA, snapB] = await Promise.all([
    fetchSnapshot(db, versionA, regionField, name, orderStatus),
    fetchSnapshot(db, versionB, regionField, name, orderStatus),
  ]);

  // 计算差异
  const DIM_LABELS: Record<string, string> = {
    age_group: '年龄段', education: '学历', occupation_category: '职业',
    annual_income: '家庭收入', family_structure: '家庭结构', is_upgrade: '增换购', city_tier: '城市级别',
  };

  const dimDiffs = Object.keys(snapA.dims).map(key => {
    const a = snapA.dims[key];
    const b = snapB.dims[key];
    // 找出所有 label，合并
    const allLabels = [...new Set([...a.map(x => x.label), ...b.map(x => x.label)])];
    const changes = allLabels.map(label => {
      const av = a.find(x => x.label === label)?.pct ?? 0;
      const bv = b.find(x => x.label === label)?.pct ?? 0;
      return { label, vA: av, vB: bv, diff: parseFloat((av - bv).toFixed(1)) };
    }).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 3);
    return { key, label: DIM_LABELS[key] || key, changes };
  });

  return NextResponse.json({
    regionName: name,
    orderStatus,
    versionA: { ...snapA, uploadedAt: vMap[versionA].uploaded_at },
    versionB: { ...snapB, uploadedAt: vMap[versionB].uploaded_at },
    dimDiffs,
  });
}
