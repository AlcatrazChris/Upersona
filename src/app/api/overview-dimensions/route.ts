import { NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { PROFILE_DIMENSIONS } from '@/types';

export const dynamic = 'force-dynamic';

const STATUS_GROUPS = [
  { key: '锁单/提车', values: ['已锁单', '订单完成'], color: '#34C759' },
  { key: '未锁单',   values: ['未锁单'],              color: '#FF9500' },
  { key: '退单',     values: ['退单'],                color: '#FF3B30' },
];

// 计算时涉及的维度列
const OVERVIEW_DIMS = [
  'age_group', 'education', 'occupation_category', 'family_structure',
  'annual_income', 'is_upgrade', 'consumption_views', 'use_scenarios',
  'info_channels', 'car_interests', 'hobbies', 'competing_models',
];

// ── 进程内缓存：版本不变时跳过重复计算（overview-dimensions 是最重的路由）──
let _cache: { versionId: number; data: unknown } | null = null;

export async function GET() {
  const db = createServiceClient();
  const { data: vd } = await db.from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!vd) return NextResponse.json({ dims: [] });

  // 命中缓存：直接返回，跳过全表扫描
  if (_cache && _cache.versionId === vd.version_id) {
    return NextResponse.json(_cache.data);
  }

  const cols  = OVERVIEW_DIMS.join(', ') + ', order_status';
  const users = await fetchUsers(db, cols, q => q.eq('data_version', vd.version_id));
  if (!users.length) return NextResponse.json({ dims: [] });

  // 按订单状态分组（仍需 O(n) 一次 filter）
  const statusGroups = STATUS_GROUPS.map(sg => {
    const grpUsers = (users as Record<string, unknown>[]).filter(u =>
      sg.values.includes(String(u.order_status))
    );
    return { ...sg, users: grpUsers, total: grpUsers.length };
  });

  // ── 为每个维度预建计数 Map（O(n × dims)），替代行级 filter()（O(n² × dims × groups)）──
  const result = OVERVIEW_DIMS.map(dimKey => {
    const dimConfig = PROFILE_DIMENSIONS.find(d => d.key === dimKey);
    if (!dimConfig) return null;

    // 收集标签集合 + 全局计数（O(n) 一次遍历）
    const labelSet      = new Set<string>();
    const totalCntMap: Record<string, number> = {};

    for (const u of users as Record<string, unknown>[]) {
      const raw = u[dimKey];
      if (dimConfig.isMultiSelect && Array.isArray(raw)) {
        for (const v of raw as string[]) {
          if (v && v !== '(跳过)') {
            labelSet.add(v);
            totalCntMap[v] = (totalCntMap[v] || 0) + 1;
          }
        }
      } else {
        const v = String(raw || '').trim();
        if (v && v !== '(跳过)') {
          labelSet.add(v);
          totalCntMap[v] = (totalCntMap[v] || 0) + 1;
        }
      }
    }

    let allLabels = Array.from(labelSet);
    if (dimConfig.isOrdered && dimConfig.orderedValues) {
      const om = Object.fromEntries(dimConfig.orderedValues.map((v, i) => [v, i]));
      allLabels.sort((a, b) => (om[a] ?? 999) - (om[b] ?? 999));
    } else {
      allLabels.sort((a, b) => (totalCntMap[b] || 0) - (totalCntMap[a] || 0));
    }

    // 为每个订单状态组建 Map（O(n × groups) 总计）
    interface GroupMap {
      map: Record<string, number>;
      multiSelectDenom: number;
      total: number;
    }
    const groupMaps: GroupMap[] = statusGroups.map(sg => {
      const map: Record<string, number> = {};
      let multiSelectDenom = 0;
      for (const u of sg.users) {
        const raw = (u as Record<string, unknown>)[dimKey];
        if (dimConfig.isMultiSelect && Array.isArray(raw)) {
          for (const v of raw as string[]) {
            if (v && v !== '(跳过)') {
              map[v] = (map[v] || 0) + 1;
              multiSelectDenom++;
            }
          }
        } else {
          const v = String(raw || '').trim();
          if (v && v !== '(跳过)') map[v] = (map[v] || 0) + 1;
        }
      }
      return { map, multiSelectDenom, total: sg.total };
    });

    // 生成行数据（O(labels × groups)，无 filter）
    const rows = allLabels.map(label => {
      const entry: Record<string, string | number> = { label };
      for (let gi = 0; gi < statusGroups.length; gi++) {
        const sg = statusGroups[gi];
        const gm = groupMaps[gi];
        const count = gm.map[label] || 0;
        const denom = dimConfig.isMultiSelect ? gm.multiSelectDenom : gm.total;
        entry[sg.key] = denom > 0 ? parseFloat((count / denom * 100).toFixed(1)) : 0;
      }
      return entry;
    });

    return { dimKey, dimLabel: dimConfig.label, rows, allLabels };
  }).filter(Boolean);

  const data = { dims: result, statusGroups: STATUS_GROUPS, totalSamples: users.length };

  // 写入进程缓存
  _cache = { versionId: vd.version_id, data };

  return NextResponse.json(data);
}
