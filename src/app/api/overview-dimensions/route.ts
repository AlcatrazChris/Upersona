import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { getProfileDimensions, getDimensionColumns } from '@/lib/dimensions';
import { countDimension, sortLabels } from '@/lib/sample-counter';

export const dynamic = 'force-dynamic';

const STATUS_GROUPS = [
  { key: '锁单/提车', values: ['已锁单', '订单完成'], color: '#34C759' },
  { key: '未锁单',   values: ['未锁单'],              color: '#FF9500' },
  { key: '退单',     values: ['退单'],                color: '#FF3B30' },
];

// 进程内缓存
let _cache: { versionId: number; dimHash: string; data: unknown } | null = null;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedVersionId = searchParams.get('versionId');
  const db = createServiceClient();

  const versionQuery = db.from('data_versions').select('version_id');
  const { data: vd } = requestedVersionId
    ? await versionQuery.eq('version_id', parseInt(requestedVersionId, 10)).single()
    : await versionQuery.eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!vd) return NextResponse.json({ dims: [] });

  // 动态加载维度配置
  const allDims = await getProfileDimensions(db);
  const dimHash = allDims.map(d => d.key).join(',');

  // 命中缓存
  if (_cache && _cache.versionId === vd.version_id && _cache.dimHash === dimHash) {
    return NextResponse.json(_cache.data);
  }

  const cols = getDimensionColumns(allDims, ['order_status']);

  let users;
  try {
    users = await fetchUsers(db, cols, q => q.eq('data_version', vd.version_id));
  } catch {
    // 某列不存在时降级（仅用已知安全列）
    const safeCols = 'age_group,education,occupation_category,family_structure,annual_income,is_upgrade,order_status';
    users = await fetchUsers(db, safeCols, q => q.eq('data_version', vd.version_id));
  }
  if (!users.length) return NextResponse.json({ dims: [] });

  // 按订单状态分组
  const statusGroups = STATUS_GROUPS.map(sg => ({
    ...sg,
    users: (users as Record<string, unknown>[]).filter(u =>
      sg.values.includes(String(u.order_status))
    ),
  }));

  // 为每个维度计算分布
  const result = allDims.map(dimConfig => {
    const dimKey = dimConfig.key as string;

    // 使用统一 countDimension
    const globalCr = countDimension(users as Record<string, unknown>[], dimKey, dimConfig.isMultiSelect);
    if (Object.keys(globalCr.counter).length === 0) return null; // 该维度全空

    const allLabels = sortLabels(
      Object.keys(globalCr.counter), globalCr.counter,
      dimConfig.isOrdered, dimConfig.orderedValues
    );

    // 每个状态组的计数
    const groupCounts = statusGroups.map(sg =>
      countDimension(sg.users, dimKey, dimConfig.isMultiSelect)
    );

    const statusSampleCounts = Object.fromEntries(statusGroups.map((sg, gi) => {
      const gc = groupCounts[gi];
      return [sg.key, dimConfig.isMultiSelect ? gc.multiSelectDenom : gc.validUserCount];
    }));

    const rows = allLabels.map(label => {
      const entry: Record<string, string | number> = { label };
      for (let gi = 0; gi < statusGroups.length; gi++) {
        const gc    = groupCounts[gi];
        const count = gc.counter[label] || 0;
        const denom = dimConfig.isMultiSelect ? gc.multiSelectDenom : gc.validUserCount;
        entry[statusGroups[gi].key] = denom > 0 ? parseFloat((count / denom * 100).toFixed(1)) : 0;
      }
      return entry;
    });

    return { dimKey, dimLabel: dimConfig.label, rows, allLabels, statusSampleCounts };
  }).filter(Boolean);

  // validTotalUsers = 至少一个维度有值的用户
  const validTotal = (users as Record<string, unknown>[]).filter(u =>
    allDims.some(d => {
      const raw = u[d.key as string];
      if (d.isMultiSelect && Array.isArray(raw)) return (raw as string[]).some(v => v && v.trim() && v !== '(跳过)');
      const v = String(raw ?? '').trim();
      return v !== '' && v !== '(跳过)';
    })
  ).length;

  const data = { dims: result, statusGroups: STATUS_GROUPS, totalSamples: validTotal, versionId: vd.version_id };

  _cache = { versionId: vd.version_id, dimHash, data };

  return NextResponse.json(data);
}
