'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Radar, MapPin, Loader2, AlertCircle, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { RadarChart } from '@/components/charts/RadarChart';
import { OrderStatusFilter } from '@/components/OrderStatusFilter';
import { cn } from '@/lib/utils';
import type { RadarData, OrderStatus, RegionType } from '@/types';

const TYPE_TABS = [
  { key: 'area'     as RegionType, label: '大区' },
  { key: 'province' as RegionType, label: '省份' },
  { key: 'city'     as RegionType, label: '城市' },
];

interface RegionItem { name: string; count: number; }
interface RegionsData {
  areas: { name: string; count: number; provinces: { name: string; count: number; cities: RegionItem[] }[] }[];
}

export default function PredictPage() {
  const [regionType, setRegionType] = useState<RegionType>('area');
  const [regionsData, setRegionsData] = useState<RegionsData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('all');
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/regions').then(r => r.json()).then(setRegionsData);
  }, []);

  const regionOptions: RegionItem[] = !regionsData ? [] :
    regionType === 'area'     ? regionsData.areas.map(a => ({ name: a.name, count: a.count }))
    : regionType === 'province' ? regionsData.areas.flatMap(a => a.provinces.map(p => ({ name: p.name, count: p.count })))
    : regionsData.areas.flatMap(a => a.provinces.flatMap(p => p.cities));

  function handleTypeChange(t: RegionType) {
    setRegionType(t); setSelectedRegion(''); setRadarData(null);
  }

  const fetchRadar = useCallback(async () => {
    if (!selectedRegion) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ type: regionType, name: selectedRegion, orderStatus });
      const res = await fetch(`/api/radar?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRadarData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, [selectedRegion, regionType, orderStatus]);

  useEffect(() => { if (selectedRegion) fetchRadar(); }, [selectedRegion, regionType, orderStatus]); // eslint-disable-line

  return (
    <div className="space-y-5">
      {/* 控制区 */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 glass-card-subtle p-1 rounded-ios">
            {TYPE_TABS.map(tab => (
              <button key={tab.key} onClick={() => handleTypeChange(tab.key)}
                className={cn('px-3 py-1.5 rounded-[8px] text-[13px] font-500 transition-all no-tap',
                  regionType === tab.key ? 'bg-white shadow-ios-sm text-black/80' : 'text-black/45 hover:text-black/65')}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-black/40">选择地区</span>
            <RegionSelect options={regionOptions} value={selectedRegion} onChange={setSelectedRegion}
              placeholder={`选择${regionType === 'area' ? '大区' : regionType === 'province' ? '省份' : '城市'}`} />
          </div>
        </div>
        <OrderStatusFilter value={orderStatus} onChange={v => { setOrderStatus(v); setRadarData(null); }} />
        {!selectedRegion && (
          <div className="text-[12px] text-black/35 flex items-center gap-1.5">
            <Radar size={12} />
            选择地区，查看五维用户特征雷达图（与全国均值对比）
          </div>
        )}
      </div>

      {error && (
        <div className="glass-card p-4 flex items-center gap-2 border border-[#FF3B30]/20">
          <AlertCircle size={15} className="text-[#FF3B30]" />
          <span className="text-[13px] text-black/65">{error}</span>
        </div>
      )}

      {loading && (
        <div className="glass-card p-12 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-[#007AFF]" />
          <span className="text-[13px] text-black/45">计算雷达图数据…</span>
        </div>
      )}

      {!loading && radarData && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-slide-up">
          {/* 左：雷达图 */}
          <div className="glass-card p-5 lg:col-span-3">
            <RadarChart
              dimensions={radarData.dimensions}
              regionName={radarData.regionName}
              sampleCount={radarData.sampleCount}
            />
          </div>

          {/* 右：数值明细 */}
          <div className="glass-card p-5 lg:col-span-2">
            <h3 className="text-[14px] font-600 text-black/70 mb-3">维度明细</h3>
            <div className="space-y-3">
              {radarData.dimensions.map(d => {
                const diff = parseFloat((d.score - d.nationalScore).toFixed(1));
                const isUp   = diff > 2;
                const isDown = diff < -2;
                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-black/65">{d.label}</span>
                      <div className="flex items-center gap-2">
                        {/* 趋势箭头 */}
                        {isUp   && <TrendingUp   size={12} className="text-[#34C759]" />}
                        {isDown && <TrendingDown  size={12} className="text-[#FF3B30]" />}
                        {!isUp && !isDown && <Minus size={12} className="text-black/25" />}
                        <span className="text-[13px] font-600 tabular-nums"
                          style={{ color: isUp ? '#34C759' : isDown ? '#FF3B30' : 'rgba(0,0,0,0.55)' }}>
                          {d.score.toFixed(1)}{d.unit === '%' ? '%' : ''}
                        </span>
                      </div>
                    </div>
                    {/* 地区分数条 */}
                    <div className="relative h-1.5 rounded-full bg-black/06 overflow-hidden">
                      {/* 全国均值标记 */}
                      <div className="absolute top-0 h-full w-px bg-black/25 z-10"
                        style={{ left: `${Math.min(d.nationalScore, 100)}%` }} />
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(d.score, 100)}%`,
                          background: isUp ? 'linear-gradient(90deg,#34C759,#5AC8FA)'
                                    : isDown ? 'linear-gradient(90deg,#FF3B30,#FF9500)'
                                    : '#007AFF',
                          opacity: 0.8,
                        }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-black/30">
                        全国均值 {d.nationalScore.toFixed(1)}{d.unit === '%' ? '%' : ''}
                      </span>
                      <span className={cn('text-[10px] font-500',
                        isUp ? 'text-[#34C759]' : isDown ? 'text-[#FF3B30]' : 'text-black/30')}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {radarData.cached && (
              <div className="mt-4 pt-3 border-t border-black/06 text-[11px] text-black/30">
                全国均值来自预缓存数据
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RegionSelect({ options, value, onChange, placeholder }: {
  options: RegionItem[]; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({ position: 'fixed', left: rect.left, top: rect.bottom + 4,
      minWidth: rect.width, maxHeight: 260, zIndex: 99999 });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = options.filter(o => !search || o.name.includes(search));

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(p => !p)}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] transition-all no-tap',
          value ? 'bg-[#007AFF]/10 text-[#007AFF] font-500 border border-[#007AFF]/20'
                : 'glass-card-subtle text-black/55 hover:bg-white/60')}>
        {value || placeholder}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && typeof window !== 'undefined' && createPortal(
        <div ref={menuRef} style={menuStyle}
          className="glass-card-elevated py-1.5 animate-scale-in shadow-ios-xl overflow-y-auto">
          <div className="px-2 pb-1.5 border-b border-black/06">
            <input type="text" placeholder="搜索…" value={search}
              onChange={e => setSearch(e.target.value)} autoFocus
              className="input-ios text-[12px] py-1" />
          </div>
          {filtered.map(opt => (
            <button key={opt.name}
              onMouseDown={e => { e.preventDefault(); onChange(opt.name); setOpen(false); setSearch(''); }}
              className={cn('w-full flex items-center justify-between px-3 py-2 text-[13px] no-tap transition-colors',
                value === opt.name ? 'text-[#007AFF] font-500 bg-[#007AFF]/06' : 'text-black/65 hover:bg-black/04')}>
              <span>{opt.name}</span>
              <span className="text-[11px] text-black/30 tabular-nums">n={opt.count}</span>
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}
