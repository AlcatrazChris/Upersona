'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartConfigPanel } from '@/components/charts/ChartConfigPanel';
import { RegionCascade } from '@/components/RegionCascade';
import { OrderStatusFilter } from '@/components/OrderStatusFilter';
import { useRole } from '@/components/RoleProvider';
import { cn } from '@/lib/utils';
import { loadChartConfig, saveChartConfig } from '@/lib/chartConfig';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ChartType } from '@/components/charts/engine/types';
import type { ProfileData, OrderStatus } from '@/types';

// 提取到组件外部，防止每次渲染创建新函数引用导致 React 强制重挂载
function DimChartCard({
  dim, delay, config, onConfigChange, onHide,
}: {
  dim: ProfileData;
  delay: number;
  config: ChartConfig;
  onConfigChange: (c: ChartConfig) => void;
  onHide: () => void;
}) {
  const resolvedType: ChartType =
    dim.chartType === 'pie' ? 'donut' : (dim.chartType as ChartType) ?? 'bar';
  return (
    <ChartCard
      title={dim.dimensionLabel}
      note={dim.note}
      data={dim.items}
      config={config}
      chartType={resolvedType}
      isMultiSelect={dim.isMultiSelect}
      totalSamples={dim.totalSamples}
      validSamples={dim.validSamples}
      onConfigChange={onConfigChange}
      onHide={onHide}
      animationDelay={delay}
    />
  );
}

export default function ProfilePage() {
  const role    = useRole();
  const isAdmin = role === 'admin';

  const [filter, setFilter]       = useState<{ area?: string; province?: string; city?: string }>({});
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('all');
  const [data, setData]           = useState<ProfileData[] | null>(null);
  const [loading, setLoading]     = useState(true);
  const [totalSamples, setTotalSamples] = useState(0);
  const [chartConfig, setChartConfig] = useState<ChartConfig>(() => loadChartConfig('profile'));

  function handleConfigChange(c: ChartConfig) {
    setChartConfig(c);
    saveChartConfig('profile', c);
  }

  const fetchData = useCallback(async () => {
    setData(null);
    setTotalSamples(0);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.city)          params.set('city', filter.city);
      else if (filter.province) params.set('province', filter.province);
      else if (filter.area)     params.set('area', filter.area);
      if (orderStatus !== 'all') params.set('orderStatus', orderStatus);
      const res  = await fetch(`/api/profile?${params}`, { cache: 'no-store' });
      const json = await res.json();
      setData(json.dimensions ?? []);
      setTotalSamples(json.totalSamples ?? 0);
    } catch (e) {
      console.error('profile fetch error', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filter, orderStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 管理员：从画像中隐藏字段（乐观更新：立即移除，API 后台执行）
  function hideDim(dimKey: string) {
    setData(prev => prev ? prev.filter(d => d.dimension !== dimKey) : prev);
    fetch('/api/dimensions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimensions: [{ dim_key: dimKey, enabled_profile: false }] }),
    }).catch(() => {
      // 失败时重新拉取恢复数据
      fetchData();
    });
  }

  const filterLabel = filter.city || filter.province || filter.area || '全国';
  const orderLabel  = orderStatus === 'all' ? '' : ` · ${orderStatus}`;

  // 按 groupName 分组，仅当存在非空分组时启用
  const groupedData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const hasGroups = data.some(d => d.groupName && d.groupName.trim());
    if (!hasGroups) return null;

    const groupOrder: string[] = [];
    const groupMap: Record<string, ProfileData[]> = {};
    for (const dim of data) {
      const g = (dim.groupName || '').trim();
      if (!groupOrder.includes(g)) groupOrder.push(g);
      if (!groupMap[g]) groupMap[g] = [];
      groupMap[g].push(dim);
    }
    const sorted = [
      ...groupOrder.filter(g => g !== ''),
      ...groupOrder.filter(g => g === ''),
    ];
    return sorted.map(name => ({ name, dims: groupMap[name] || [] }));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* 筛选器 */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-black/45">
            <Filter size={13} />
            <span className="text-[13px]">筛选地区</span>
          </div>
          <RegionCascade value={filter} onChange={v => setFilter(v)} />
          {(filter.area || filter.province || filter.city) && (
            <button onClick={() => setFilter({})} className="text-[12px] text-[#007AFF]">清除</button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[13px] text-black/40 tabular-nums">
              {filterLabel}{orderLabel} ·{' '}
              {loading
                ? <span className="inline-block w-10 h-3.5 bg-black/08 rounded animate-pulse align-middle" />
                : <span className="font-500 text-black/65">{totalSamples.toLocaleString()}</span>
              }
              {' '}个样本
            </span>
            <ChartConfigPanel config={chartConfig} onChange={handleConfigChange} showLegendOption={false} />
            <button onClick={fetchData} disabled={loading}
              className={cn('btn-ios btn-secondary text-[13px] py-1.5 px-3', loading && 'opacity-50 cursor-not-allowed')}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />刷新
            </button>
          </div>
        </div>
        <OrderStatusFilter value={orderStatus} onChange={v => setOrderStatus(v)} />
      </div>

      {/* 图表区域 */}
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
        groupedData ? (
          // ── 分组模式 ──────────────────────────────────────────
          <div className="space-y-8">
            {groupedData.map((group, gi) => (
              <div key={group.name || '__ungrouped'}>
                {group.name && (
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[12px] font-600 text-black/45 tracking-wider">{group.name}</span>
                    <div className="flex-1 h-px bg-black/08" />
                    <span className="text-[11px] text-black/25 tabular-nums">{group.dims.length} 项</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.dims.map((dim, i) => (
                    <DimChartCard key={dim.dimension} dim={dim} delay={(gi * 3 + i) * 35}
                      config={chartConfig} onConfigChange={handleConfigChange}
                      onHide={() => hideDim(dim.dimension as string)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // ── 平铺模式（无分组）────────────────────────────────
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((dim, i) => (
              <DimChartCard key={dim.dimension} dim={dim} delay={i * 40}
              config={chartConfig} onConfigChange={handleConfigChange}
              onHide={() => hideDim(dim.dimension as string)} />
            ))}
          </div>
        )
      ) : (
        <div className="glass-card p-12 text-center">
          <div className="text-black/30 text-[15px]">暂无数据</div>
        </div>
      )}
    </div>
  );
}
