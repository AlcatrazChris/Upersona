'use client';

import { useEffect, useState } from 'react';
import { OverviewStats } from '@/components/OverviewStats';
import { OverviewCompare } from '@/components/OverviewCompare';
import type { DimensionConfig, DataVersion } from '@/types';

interface OverviewData {
  total: number; locked: number; pending: number; cancelled: number;
  lockedRate: string; cancelledRate: string;
  areaDistribution: { area: string; total: number; locked: number; pending: number; cancelled: number }[];
  version: { version_id: number; record_count: number; uploaded_at: string } | null;
}

export default function HomePage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [profileDims, setProfileDims] = useState<DimensionConfig[]>([]);
  const [versions, setVersions] = useState<DataVersion[]>([]);
  const [dimsLoaded, setDimsLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/overview', { cache: 'no-store' })
      .then(r => r.json()).then(setData).catch(console.error);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/dimensions').then(r => r.json()),
      fetch('/api/versions').then(r => r.ok ? r.json() : []),
    ]).then(([dims, vers]) => {
      if (Array.isArray(dims)) setProfileDims(dims.filter((d: DimensionConfig) => d.enabledProfile !== false));
      if (Array.isArray(vers)) setVersions(vers);
      setDimsLoaded(true);
    }).catch(() => setDimsLoaded(true));
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
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      <OverviewStats data={data} />

      {/* Overview Compare */}
      {dimsLoaded && profileDims.length > 0 && versions.length > 0 && (
        <OverviewCompare versions={versions} profileDims={profileDims} />
      )}
    </div>
  );
}
