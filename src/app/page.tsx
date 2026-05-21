import { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase';
import { OverviewStats } from '@/components/OverviewStats';

export const metadata: Metadata = { title: '概览' };

async function getOverviewData() {
  const db = createServiceClient();

  const [usersRes, versionRes] = await Promise.all([
    db.from('active_users').select('intent_label, region_area, order_status'),
    db.from('data_versions').select('*').eq('is_active', true).single(),
  ]);

  const users = usersRes.data || [];
  const total = users.length;
  const strongIntent = users.filter((u: { intent_label: number }) => u.intent_label === 1).length;
  const weakIntent = total - strongIntent;

  // 大区分布（按样本量排序）
  const areaMap: Record<string, number> = {};
  for (const u of users) {
    areaMap[u.region_area] = (areaMap[u.region_area] || 0) + 1;
  }
  const areaDistribution = Object.entries(areaMap)
    .sort((a, b) => b[1] - a[1])
    .map(([area, count]) => ({ area, count, pct: (count / total * 100).toFixed(1) }));

  return {
    total,
    strongIntent,
    weakIntent,
    conversionRate: total > 0 ? (strongIntent / total * 100).toFixed(1) : '0',
    areaDistribution,
    version: versionRes.data,
  };
}

export default async function HomePage() {
  const data = await getOverviewData();

  return (
    <div className="space-y-6 animate-slide-up">
      <OverviewStats data={data} />
    </div>
  );
}
