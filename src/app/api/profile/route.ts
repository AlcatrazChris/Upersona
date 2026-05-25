import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, fetchUsers } from '@/lib/supabase';
import { PROFILE_DIMENSIONS } from '@/types';

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

  const COLS = 'age_group, education, occupation_category, family_structure, annual_income, is_upgrade, consumption_views, competing_models, use_scenarios, family_trip_frequency, info_channels, car_interests, hobbies, order_status';
  let users;
  try {
    users = await fetchUsers(db, COLS, q => {
      let r = q.eq('data_version', versionData.version_id);
      if (city)          r = r.eq('region_city', city);
      else if (province) r = r.eq('region_province', province);
      else if (area)     r = r.eq('region_area', area);
      if (orderStatus && orderStatus !== 'all') r = orderStatus === '锁单/提车' ? r.in('order_status', ['已锁单', '订单完成']) : r.eq('order_status', orderStatus);
      return r;
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  if (!users || users.length === 0) return NextResponse.json({ dimensions: [], totalSamples: 0 });

  const totalSamples = users.length;
  const dims = dim ? PROFILE_DIMENSIONS.filter(d => d.key === dim) : PROFILE_DIMENSIONS;

  const results = dims.map(config => {
    const { key, label, isOrdered, isMultiSelect, orderedValues, note } = config;
    const counter: Record<string, number> = {};

    if (isMultiSelect) {
      for (const user of users) {
        const arr = (user as Record<string, string[]>)[key as string] as string[] | undefined;
        if (!arr) continue;
        for (const val of arr) {
          if (!val || val === '(跳过)') continue;
          counter[val] = (counter[val] || 0) + 1;
        }
      }
      // 多选题分母 = 所有选项计数的总和（每个选项占总提及量的比例）
      const multiTotal = Object.values(counter).reduce((s, c) => s + c, 0);

      let items = Object.entries(counter).map(([lbl, count]) => ({
        label: lbl, count,
        percentage: multiTotal > 0 ? parseFloat((count / multiTotal * 100).toFixed(1)) : 0,
      }));

      if (isOrdered && orderedValues) {
        const orderMap = Object.fromEntries(orderedValues.map((v, i) => [v, i]));
        items.sort((a, b) => (orderMap[a.label] ?? 999) - (orderMap[b.label] ?? 999));
      } else {
        items.sort((a, b) => b.count - a.count);
      }

      return {
        dimension: key, dimensionLabel: label, items,
        totalSamples, validSamples: multiTotal,
        isMultiSelect: true,
        note: note ? note.replace('总和 > 100%', '各项之和 = 100%') : '各项之和 = 100%',
      };
    } else {
      let skipped = 0;
      for (const user of users) {
        const val = String((user as Record<string, string>)[key as string] || '').trim();
        if (!val || val === '(跳过)') { skipped++; continue; }
        counter[val] = (counter[val] || 0) + 1;
      }
      const validSamples = totalSamples - skipped;

      let items = Object.entries(counter).map(([lbl, count]) => ({
        label: lbl, count,
        percentage: validSamples > 0 ? parseFloat((count / validSamples * 100).toFixed(1)) : 0,
      }));

      if (isOrdered && orderedValues) {
        const orderMap = Object.fromEntries(orderedValues.map((v, i) => [v, i]));
        items.sort((a, b) => (orderMap[a.label] ?? 999) - (orderMap[b.label] ?? 999));
      } else {
        items.sort((a, b) => b.count - a.count);
      }

      return { dimension: key, dimensionLabel: label, items, totalSamples, validSamples, isMultiSelect: false, note };
    }
  });

  return NextResponse.json({ dimensions: results, totalSamples, filter: { area, province, city, orderStatus } });
}
