'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AiUserCard } from '@/components/insights/AiUserCard';
import { OrderStatusFilter } from '@/components/OrderStatusFilter';
import { cn } from '@/lib/utils';
import type { CoreUserProfile, OrderStatus, RegionType } from '@/types';

const TYPE_TABS = [
  { key: 'area' as RegionType,     label: '大区' },
  { key: 'province' as RegionType, label: '省份' },
  { key: 'city' as RegionType,     label: '城市' },
];

interface RegionItem { name: string; count: number; }
interface RegionsData {
  areas: { name: string; count: number; provinces: { name: string; count: number; cities: RegionItem[] }[] }[];
}

export default function InsightsPage() {
  const [regionType, setRegionType]   = useState<RegionType>('area');
  const [regionsData, setRegionsData] = useState<RegionsData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('all');
  const [profileData, setProfileData] = useState<CoreUserProfile | null>(null);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    fetch('/api/regions').then(r => r.json()).then(setRegionsData);
  }, []);

  const regionOptions: RegionItem[] = !regionsData ? [] :
    regionType === 'area'     ? regionsData.areas.map(a => ({ name: a.name, count: a.count }))
    : regionType === 'province' ? regionsData.areas.flatMap(a => a.provinces.map(p => ({ name: p.name, count: p.count })))
    : regionsData.areas.flatMap(a => a.provinces.flatMap(p => p.cities));

  function handleTypeChange(t: RegionType) {
    setRegionType(t); setSelectedRegion(''); setProfileData(null);
  }

  const fetchProfile = useCallback(async (noCache = false) => {
    if (!selectedRegion) return;
    noCache ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ type: regionType, name: selectedRegion, orderStatus, ...(noCache ? { noCache: '1' } : {}) });
      const res = await fetch(`/api/insights?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProfileData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [selectedRegion, regionType, orderStatus]);

  useEffect(() => {
    if (selectedRegion) fetchProfile();
  }, [selectedRegion, regionType, orderStatus]); // eslint-disable-line

  return (
    <div className="space-y-5">
      {/* 控制区 */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 层级切换 */}
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

        {/* 订单状态筛选 */}
        <OrderStatusFilter value={orderStatus} onChange={v => { setOrderStatus(v); setProfileData(null); }} />

        {!selectedRegion && (
          <div className="text-[12px] text-black/35 flex items-center gap-1.5">
            <MapPin size={12} />选择地区后，AI 将自动生成核心用户画像卡片
          </div>
        )}
      </div>

      {/* 错误 */}
      {error && (
        <div className="glass-card p-4 flex items-center gap-2 border border-[#FF3B30]/20">
          <AlertCircle size={15} className="text-[#FF3B30]" />
          <span className="text-[13px] text-black/65">{error}</span>
        </div>
      )}

      {/* 加载 */}
      {loading && (
        <div className="glass-card p-16 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#5856D6]" />
          <span className="text-[14px] text-black/45">AI 正在生成用户画像…</span>
          <span className="text-[12px] text-black/30">首次生成约需 5-10 秒</span>
        </div>
      )}

      {/* AI 画像卡片 */}
      {!loading && profileData && (
        <AiUserCard
          data={profileData}
          onRefresh={() => fetchProfile(true)}
          refreshing={refreshing}
        />
      )}
    </div>
  );
}

function RegionSelect({ options, value, onChange, placeholder }: {
  options: RegionItem[]; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({ position: 'fixed', left: rect.left, top: rect.bottom + 4, minWidth: rect.width, maxHeight: 260, zIndex: 99999 });
  }, []);

  useEffect(() => { if (open) { updatePos(); } }, [open, updatePos]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter(o => !search || o.name.includes(search));

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(p => !p)}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] transition-all no-tap',
          value ? 'bg-[#5856D6]/10 text-[#5856D6] font-500 border border-[#5856D6]/20' : 'glass-card-subtle text-black/55 hover:bg-white/60')}>
        {value || placeholder}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && typeof window !== 'undefined' && createPortal(
        <div ref={menuRef} style={menuStyle} className="glass-card-elevated py-1.5 animate-scale-in shadow-ios-xl overflow-y-auto">
          <div className="px-2 pb-1.5 border-b border-black/06">
            <input type="text" placeholder="搜索…" value={search} onChange={e => setSearch(e.target.value)}
              autoFocus className="input-ios text-[12px] py-1" />
          </div>
          {filtered.map(opt => (
            <button key={opt.name} onMouseDown={e => { e.preventDefault(); onChange(opt.name); setOpen(false); setSearch(''); }}
              className={cn('w-full flex items-center justify-between px-3 py-2 text-[13px] no-tap transition-colors',
                value === opt.name ? 'text-[#5856D6] font-500 bg-[#5856D6]/06' : 'text-black/65 hover:bg-black/04')}>
              <span>{opt.name}</span>
              <span className="text-[11px] text-black/30 tabular-nums">n={opt.count}</span>
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}
