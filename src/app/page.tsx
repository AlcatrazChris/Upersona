'use client';

import { useEffect, useState } from 'react';
import { OverviewStats } from '@/components/OverviewStats';

interface OverviewData {
  total: number;
  locked: number;
  pending: number;
  cancelled: number;
  lockedRate: string;
  cancelledRate: string;
  areaDistribution: { area: string; total: number; locked: number; pending: number; cancelled: number }[];
  version: { version_id: number; record_count: number; uploaded_at: string } | null;
}

export default function HomePage() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch('/api/overview', { cache: 'no-store' })
      .then(r => r.json()).then(setData).catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="glass-card p-5 h-28">
              <div className="skeleton h-4 w-20 mb-3" />
              <div className="skeleton h-8 w-16 mb-1" />
              <div className="skeleton h-3 w-12" />
            </div>
          ))}
        </div>
        <div className="glass-card p-6 h-64">
          <div className="skeleton h-5 w-32 mb-4" />
          <div className="skeleton h-44 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <OverviewStats data={data} />
    </div>
  );
}
