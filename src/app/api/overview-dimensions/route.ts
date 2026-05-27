import { NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { PROFILE_DIMENSIONS } from '@/types';

export const dynamic = 'force-dynamic';

const STATUS_GROUPS = [
  { key: '锁单/提车', values: ['已锁单', '订单完成'], color: '#34C759' },
  { key: '未锁单',   values: ['未锁单'],              color: '#FF9500' },
  { key: '退单',     values: ['退单'],                color: '#FF3B30' },
];

// Overview 展示的维度（精简版）
// 全量维度（与 PROFILE_DIMENSIONS 保持一致，多选字段也包含）
const OVERVIEW_DIMS = [
  'age_group', 'education', 'occupation_category', 'family_structure',
  'annual_income', 'is_upgrade', 'consumption_views', 'use_scenarios',
  'info_channels', 'car_interests', 'hobbies', 'competing_models',
];

export async function GET() {
  const db = createServiceClient();
  const { data: vd } = await db.from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
  if (!vd) return NextResponse.json({ dims: [] });

  const cols = OVERVIEW_DIMS.join(', ') + ', order_status';
  const users = await fetchUsers(db, cols, q => q.eq('data_version', vd.version_id));
  if (!users.length) return NextResponse.json({ dims: [] });

  const statusGroups = STATUS_GROUPS.map(sg => ({
    ...sg,
    users: users.filter((u: Record<string, unknown>) => sg.values.includes(String(u.order_status))),
    total: 0,
  }));
  statusGroups.forEach(sg => { sg.total = sg.users.length; });

  const result = OVERVIEW_DIMS.map(dimKey => {
    const dimConfig = PROFILE_DIMENSIONS.find(d => d.key === dimKey);
    if (!dimConfig) return null;

    // 收集所有标签并排序（多选字段需展开数组）
    const labelSet = new Set<string>();
    for (const u of users) {
      const raw = (u as Record<string, unknown>)[dimKey];
      if (dimConfig.isMultiSelect && Array.isArray(raw)) {
        (raw as string[]).forEach(v => { if (v && v !== '(跳过)') labelSet.add(v); });
      } else {
        const v = String(raw || '').trim();
        if (v && v !== '(跳过)') labelSet.add(v);
      }
    }
    let allLabels = Array.from(labelSet);
    if (dimConfig.isOrdered && dimConfig.orderedValues) {
      const om = Object.fromEntries(dimConfig.orderedValues.map((v, i) => [v, i]));
      allLabels.sort((a, b) => (om[a] ?? 999) - (om[b] ?? 999));
    } else {
      const cnt: Record<string, number> = {};
      for (const u of users) {
        const v = String((u as Record<string, unknown>)[dimKey] || '').trim();
        if (v) cnt[v] = (cnt[v] || 0) + 1;
      }
      allLabels.sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0));
    }

    // 每个标签在各订单状态组内的占比
    const rows = allLabels.map(label => {
      const entry: Record<string, string | number> = { label };
      for (const sg of statusGroups) {
        const count = sg.users.filter((u: Record<string, unknown>) =>
          String((u as Record<string, unknown>)[dimKey] || '').trim() === label
        ).length;
        entry[sg.key] = sg.total > 0
          ? parseFloat((count / sg.total * 100).toFixed(1))
          : 0;
      }
      return entry;
    });

    return {
      dimKey,
      dimLabel: dimConfig.label,
      rows,
      allLabels,
    };
  }).filter(Boolean);

  return NextResponse.json({ dims: result, statusGroups: STATUS_GROUPS, totalSamples: users.length });
}
