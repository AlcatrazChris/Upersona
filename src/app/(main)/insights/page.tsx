'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Loader2, AlertCircle, ChevronDown, GitCompare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AiUserCard } from '@/components/insights/AiUserCard';
import { InsightOverlay } from '@/components/InsightOverlay';
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
interface DataVersion { version_id: number; uploaded_at: string; record_count: number; is_active: boolean; }

interface VersionSnap {
  versionId: number; uploadedAt: string; sampleCount: number;
  strongCount: number; strongRatio: number;
  dims: Record<string, { label: string; pct: number }[]>;
}
interface VersionCompareData {
  versionA: VersionSnap; versionB: VersionSnap;
  dimDiffs: { key: string; label: string; changes: { label: string; vA: number; vB: number; diff: number }[] }[];
}

// ── 版本对比面板 ──────────────────────────────────────────────
function VersionComparePanel({
  regionType, regionName, orderStatus, currentVersionId, versions,
}: {
  regionType: RegionType; regionName: string; orderStatus: OrderStatus;
  currentVersionId: number; versions: DataVersion[];
}) {
  const [compareVersionId, setCompareVersionId] = useState<number | null>(null);
  const [data, setData]     = useState<VersionCompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [open, setOpen]     = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);

  const olderVersions = versions.filter(v => v.version_id !== currentVersionId);

  // 重置对比结果当地区/筛选变化时
  useEffect(() => { setData(null); setError(''); setCompareVersionId(null); }, [regionName, regionType, orderStatus]);

  // 计算下拉菜单位置
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      left: rect.right - 240, // 右对齐
      top:  rect.bottom + 4,
      width: 240,
      maxHeight: 260,
      zIndex: 99999,
    });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  async function fetchCompare(compareId: number) {
    setLoading(true); setError(''); setData(null);
    try {
      const params = new URLSearchParams({
        type: regionType, name: regionName, orderStatus,
        versionA: String(currentVersionId), versionB: String(compareId),
      });
      const res = await fetch(`/api/version-compare?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '请求失败');
      setData(json);
    } catch (e) { setError(e instanceof Error ? e.message : '请求失败'); }
    finally { setLoading(false); }
  }

  function handleSelect(id: number) {
    setCompareVersionId(id);
    setOpen(false);
    fetchCompare(id);
  }

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitCompare size={15} className="text-[#5856D6]" />
          <span className="text-[14px] font-600 text-black/70">历史版本对比</span>
          <span className="text-[12px] text-black/35">当前 v{currentVersionId}</span>
        </div>

        {/* 版本选择下拉 */}
        {olderVersions.length === 0 ? (
          <span className="text-[12px] text-black/30 px-3 py-1.5 rounded-ios glass-card-subtle">
            暂无历史版本（请再次上传数据后使用）
          </span>
        ) : (
          <>
            <button ref={triggerRef} onClick={() => setOpen(p => !p)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] transition-all no-tap',
                compareVersionId
                  ? 'bg-[#5856D6]/10 text-[#5856D6] font-500 border border-[#5856D6]/20'
                  : 'glass-card-subtle text-black/55 hover:bg-white/60')}>
              {compareVersionId
                ? `对比 v${compareVersionId}（${fmtDate(versions.find(v => v.version_id === compareVersionId)?.uploaded_at ?? '')}）`
                : '选择旧版本对比'}
              <ChevronDown size={10} className={cn('transition-transform flex-shrink-0', open && 'rotate-180')} />
            </button>
            {open && typeof window !== 'undefined' && createPortal(
              <div ref={menuRef} style={menuStyle}
                className="glass-card-elevated py-1.5 shadow-ios-xl overflow-y-auto animate-scale-in">
                {olderVersions.map(v => (
                  <button key={v.version_id}
                    onMouseDown={e => { e.preventDefault(); handleSelect(v.version_id); }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 text-[12px] hover:bg-black/04 transition-colors no-tap',
                      compareVersionId === v.version_id && 'bg-[#5856D6]/06 text-[#5856D6]'
                    )}>
                    <span className="font-600">v{v.version_id}</span>
                    <span className="text-black/40 text-[11px]">{fmtDate(v.uploaded_at)} · {v.record_count.toLocaleString()}条</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[13px] text-black/40 py-4">
          <Loader2 size={13} className="animate-spin" />对比数据加载中…
        </div>
      )}
      {error && <p className="text-[12px] text-[#FF3B30]">{error}</p>}

      {data && !loading && (
        <div className="space-y-4">
          {/* 核心指标对比 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '样本量', a: data.versionA.sampleCount, b: data.versionB.sampleCount, fmt: (n: number) => n.toLocaleString() },
              { label: '强意向数', a: data.versionA.strongCount, b: data.versionB.strongCount, fmt: (n: number) => n.toLocaleString() },
              { label: '强意向率', a: data.versionA.strongRatio, b: data.versionB.strongRatio, fmt: (n: number) => `${n}%` },
            ].map(m => {
              const diff = m.a - m.b;
              return (
                <div key={m.label} className="glass-card-subtle p-3 rounded-ios text-center">
                  <div className="text-[11px] text-black/40 mb-1">{m.label}</div>
                  <div className="text-[15px] font-600 text-black/75">{m.fmt(m.a)}</div>
                  <div className="text-[11px] text-black/40 mt-0.5">旧：{m.fmt(m.b)}</div>
                  <div className={cn('text-[11px] mt-1 font-500 flex items-center justify-center gap-0.5',
                    diff > 0 ? 'text-[#34C759]' : diff < 0 ? 'text-[#FF3B30]' : 'text-black/30')}>
                    {diff > 0 ? <TrendingUp size={10} /> : diff < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                    {diff > 0 ? '+' : ''}{m.fmt(diff)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 版本时间 */}
          <div className="text-[11px] text-black/30 text-center">
            当前 v{data.versionA.versionId}（{fmtDate(data.versionA.uploadedAt)}）
            {' vs '}
            旧版 v{data.versionB.versionId}（{fmtDate(data.versionB.uploadedAt)}）
          </div>

          {/* 维度变化表 */}
          <div>
            <div className="text-[12px] font-500 text-black/50 mb-2">各维度 TOP 变化（新 vs 旧，仅展示差异最大项）</div>
            <div className="space-y-2">
              {data.dimDiffs.filter(d => d.changes.some(c => Math.abs(c.diff) >= 1)).map(d => (
                <div key={d.key} className="glass-card-subtle px-3 py-2 rounded-ios">
                  <div className="text-[11px] font-500 text-black/50 mb-1.5">{d.label}</div>
                  <div className="space-y-1">
                    {d.changes.filter(c => Math.abs(c.diff) >= 1).map(c => (
                      <div key={c.label} className="flex items-center justify-between text-[11px]">
                        <span className="text-black/60">{c.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-black/40 tabular-nums">{c.vB}% → {c.vA}%</span>
                          <span className={cn('font-500 tabular-nums w-12 text-right',
                            c.diff > 0 ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
                            {c.diff > 0 ? '+' : ''}{c.diff}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  const [versions, setVersions]       = useState<DataVersion[]>([]);

  useEffect(() => {
    fetch('/api/regions').then(r => r.json()).then(setRegionsData);
    // 获取版本列表用于历史对比
    fetch('/api/versions').then(r => r.ok ? r.json() : []).then(d => {
      if (Array.isArray(d)) setVersions(d);
    }).catch(() => {});
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

  const currentVersion = versions.find(v => v.is_active);

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
        <InsightOverlay
          cacheKey={profileData.cacheKey || ''}
          label={`${profileData.regionName} · 核心用户画像`}
          aiContent={<AiUserCard data={profileData} refreshing={refreshing} />}
          hasAiContent={!!profileData.aiCard}
          onGenerate={() => fetchProfile()}
          onRegenerate={() => fetchProfile(true)}
          loading={refreshing}
        />
      )}

      {/* 历史版本对比 —— 只要选了地区就显示，无需等 profileData 加载完 */}
      {!loading && selectedRegion && currentVersion && (
        <VersionComparePanel
          regionType={regionType}
          regionName={selectedRegion}
          orderStatus={orderStatus}
          currentVersionId={currentVersion.version_id}
          versions={versions}
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
