'use client';

import { useState, useEffect, useCallback } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { ProfileChart } from '@/components/charts/ProfileChart';
import { ChartConfigPanel } from '@/components/charts/ChartConfigPanel';
import { RegionCascade } from '@/components/RegionCascade';
import { OrderStatusFilter } from '@/components/OrderStatusFilter';
import { cn } from '@/lib/utils';
import { loadChartConfig, saveChartConfig } from '@/lib/chartConfig';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ProfileData, OrderStatus } from '@/types';

export default function ProfilePage() {
  const [filter, setFilter]           = useState<{ area?: string; province?: string; city?: string }>({});
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('all');
  const [data, setData]               = useState<ProfileData[] | null>(null);
  const [loading, setLoading]         = useState(true);
  const [totalSamples, setTotalSamples] = useState(0);
  const [chartConfig, setChartConfig] = useState<ChartConfig>(() => loadChartConfig('profile'));

  function handleConfigChange(c: ChartConfig) { setChartConfig(c); saveChartConfig('profile', c); }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.city)          params.set('city', filter.city);
      else if (filter.province) params.set('province', filter.province);
      else if (filter.area)     params.set('area', filter.area);
      if (orderStatus !== 'all') params.set('orderStatus', orderStatus);
      const res = await fetch(`/api/profile?${params}`);
      const json = await res.json();
      setData(json.dimensions);
      setTotalSamples(json.totalSamples);
    } finally {
      setLoading(false);
    }
  }, [filter, orderStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filterLabel = filter.city || filter.province || filter.area || '全国';

  return (
    <div className="space-y-6">
      {/* 筛选器 */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-black/45">
            <Filter size={13} />
            <span className="text-[13px]">筛选地区</span>
          </div>
          <RegionCascade value={filter} onChange={setFilter} />
          {(filter.area || filter.province || filter.city) && (
            <button onClick={() => setFilter({})} className="text-[12px] text-[#007AFF]">清除</button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[13px] text-black/40">
              {filterLabel} · <span className="font-500 text-black/65">{totalSamples.toLocaleString()}</span> 个样本
            </span>
            <ChartConfigPanel config={chartConfig} onChange={handleConfigChange} showLegendOption={false} />
            <button onClick={fetchData} disabled={loading}
              className={cn('btn-ios btn-secondary text-[13px] py-1.5 px-3', loading && 'opacity-50 cursor-not-allowed')}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />刷新
            </button>
          </div>
        </div>
        {/* 订单状态筛选 */}
        <OrderStatusFilter value={orderStatus} onChange={v => { setOrderStatus(v); }} />
      </div>

      {/* 图表网格 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 13 }).map((_, i) => (
            <div key={i} className="glass-card p-6 h-64">
              <div className="skeleton h-4 w-24 mb-4" />
              <div className="skeleton h-40 w-full" />
            </div>
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((dim, i) => (
            <div key={dim.dimension} className="glass-card animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
              <ProfileChart data={dim} config={chartConfig} />
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <div className="text-black/30 text-[15px]">暂无数据</div>
        </div>
      )}
    </div>
  );
}
