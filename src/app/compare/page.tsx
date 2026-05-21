'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart2, Sparkles, RefreshCw, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { StackedBarChart } from '@/components/charts/StackedBarChart';
import { ChartConfigPanel } from '@/components/charts/ChartConfigPanel';
import { RegionMultiSelect } from '@/components/RegionMultiSelect';
import { OrderStatusFilter } from '@/components/OrderStatusFilter';
import { loadChartConfig, saveChartConfig } from '@/lib/chartConfig';
import type { ChartConfig } from '@/lib/chartConfig';
import type { RegionType } from '@/components/RegionMultiSelect';
import { PROFILE_DIMENSIONS } from '@/types';
import type { CompareData, OrderStatus } from '@/types';
import { cn } from '@/lib/utils';

const COMPARE_DIMS = PROFILE_DIMENSIONS.filter(d =>
  !['competing_models'].includes(d.key as string)
);

const TYPE_TABS: { key: RegionType; label: string }[] = [
  { key: 'area',     label: '大区' },
  { key: 'province', label: '省份' },
  { key: 'city',     label: '城市' },
];

interface RegionItem { name: string; count: number; }
interface RegionsData {
  areas: { name: string; count: number; provinces: { name: string; count: number; cities: RegionItem[] }[] }[];
}

// ── 维度选择下拉 ──
function DimSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref     = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const current = COMPARE_DIMS.find(d => d.key === value);

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMenuStyle({ position: 'fixed' as const, left: rect.left, top: rect.bottom + 4, minWidth: rect.width, maxHeight: 300, zIndex: 99999 });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button ref={ref} onClick={() => setOpen(p => !p)}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] transition-all no-tap',
          open ? 'bg-[#007AFF]/12 text-[#007AFF] border border-[#007AFF]/20' : 'glass-card-subtle text-black/60')}>
        <span className="font-500">{current?.label}</span>
        {current?.isMultiSelect && <span className="badge-ios badge-blue text-[9px]">多选</span>}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && typeof window !== 'undefined' && createPortal(
        <div ref={menuRef} style={menuStyle} className="glass-card-elevated py-1.5 animate-scale-in shadow-ios-xl overflow-y-auto">
          {COMPARE_DIMS.map(d => (
            <button key={d.key as string}
              onMouseDown={e => { e.preventDefault(); onChange(d.key as string); setOpen(false); }}
              className={cn('w-full flex items-center justify-between px-3 py-2 text-[13px] transition-colors no-tap',
                value === d.key ? 'text-[#007AFF] font-500 bg-[#007AFF]/06' : 'text-black/65 hover:bg-black/04')}>
              {d.label}
              {d.isMultiSelect && <span className="badge-ios badge-blue text-[9px] ml-1">多选</span>}
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}

// ── 图表尺寸控制面板 ──
interface ChartSize { height: number; maxBarWidth: number; }

function ChartSizePanel({ value, onChange }: { value: ChartSize; onChange: (v: ChartSize) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const w = 260;
    let left = rect.right - w;
    if (left < 8) left = rect.left;
    setPanelStyle({ position: 'fixed', top: rect.bottom + 6, left, width: w, zIndex: 99999 });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(p => !p)}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] transition-all no-tap',
          open ? 'bg-[#007AFF]/12 text-[#007AFF] border border-[#007AFF]/20' : 'glass-card-subtle text-black/55 hover:bg-white/60')}>
        图表尺寸
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div ref={panelRef} style={panelStyle} className="glass-card-elevated p-4 animate-scale-in shadow-ios-xl">
          <div className="text-[11px] text-black/35 font-500 uppercase tracking-wider mb-3">图表尺寸</div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-black/55 w-16 flex-shrink-0">图表高度</span>
              <input type="range" min={200} max={600} step={20} value={value.height}
                onChange={e => onChange({ ...value, height: Number(e.target.value) })}
                className="flex-1 h-1 rounded-full cursor-pointer" style={{ accentColor: '#007AFF' }} />
              <span className="text-[11px] text-black/40 w-12 text-right tabular-nums">{value.height}px</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-black/55 w-16 flex-shrink-0">最大宽度</span>
              <input type="range" min={40} max={120} step={5} value={value.maxBarWidth}
                onChange={e => onChange({ ...value, maxBarWidth: Number(e.target.value) })}
                className="flex-1 h-1 rounded-full cursor-pointer" style={{ accentColor: '#007AFF' }} />
              <span className="text-[11px] text-black/40 w-12 text-right tabular-nums">{value.maxBarWidth}px</span>
            </div>
          </div>

          <button
            onClick={() => onChange({ height: 300, maxBarWidth: 60 })}
            className="mt-3 text-[11px] text-black/35 hover:text-[#007AFF] transition-colors"
          >
            恢复默认
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

// ── 主页面 ──
export default function ComparePage() {
  const [regionType, setRegionType]   = useState<RegionType>('area');
  const [regionsData, setRegionsData] = useState<RegionsData | null>(null);
  const [selected, setSelected]       = useState<string[]>([]);
  const [dimension, setDimension]     = useState(COMPARE_DIMS[0].key as string);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('all');
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [loading, setLoading]         = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError]             = useState('');
  const [chartConfig, setChartConfig] = useState<ChartConfig>(() => loadChartConfig('compare'));
  const [chartSize, setChartSize]     = useState<ChartSize>({ height: 300, maxBarWidth: 60 });

  function handleConfigChange(c: ChartConfig) { setChartConfig(c); saveChartConfig('compare', c); }

  useEffect(() => {
    fetch('/api/regions').then(r => r.json()).then(setRegionsData);
  }, []);

  const regionOptions: RegionItem[] = !regionsData ? [] :
    regionType === 'area'     ? regionsData.areas.map(a => ({ name: a.name, count: a.count }))
    : regionType === 'province' ? regionsData.areas.flatMap(a => a.provinces.map(p => ({ name: p.name, count: p.count })))
    : regionsData.areas.flatMap(a => a.provinces.flatMap(p => p.cities));

  function handleTypeChange(t: RegionType) {
    setRegionType(t); setSelected([]); setCompareData(null);
  }

  const runCompare = useCallback(async (noCache = false) => {
    if (selected.length < 2) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        regions: selected.join(','), type: regionType, dim: dimension,
        orderStatus, ...(noCache ? { noCache: '1' } : {}),
      });
      const res = await fetch(`/api/compare?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCompareData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, [selected, regionType, dimension, orderStatus]);

  const prevKey = useRef('');
  useEffect(() => {
    if (selected.length < 2) return;
    const key = [selected.join(','), regionType, dimension, orderStatus].join('|');
    if (key === prevKey.current) return;
    prevKey.current = key;
    runCompare();
  }, [selected, dimension, regionType, orderStatus, runCompare]);

  async function refreshInsight() {
    if (!compareData) return;
    setInsightLoading(true);
    try {
      const params = new URLSearchParams({
        regions: selected.join(','), type: regionType,
        dim: dimension, orderStatus, noCache: '1',
      });
      const res = await fetch(`/api/compare?${params}`);
      const json = await res.json();
      if (res.ok) setCompareData(json);
    } finally {
      setInsightLoading(false);
    }
  }

  const dimConfig = COMPARE_DIMS.find(d => d.key === dimension);

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
            <span className="text-[13px] text-black/40">对比维度</span>
            <DimSelect value={dimension} onChange={v => { setDimension(v); setCompareData(null); }} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ChartSizePanel value={chartSize} onChange={setChartSize} />
            <ChartConfigPanel config={chartConfig} onChange={handleConfigChange} showLegendOption={true} />
            {selected.length >= 2 && (
              <button onClick={() => runCompare()} disabled={loading}
                className={cn('btn-ios btn-secondary text-[13px] py-1.5 px-3', loading && 'opacity-50')}>
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />刷新
              </button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-[13px] text-black/40 mt-1.5 flex-shrink-0">选择地区</span>
          <RegionMultiSelect type={regionType} options={regionOptions}
            selected={selected} onChange={setSelected} maxSelect={12} />
        </div>

        <OrderStatusFilter value={orderStatus} onChange={v => { setOrderStatus(v); setCompareData(null); }} />

        {selected.length < 2 && (
          <div className="text-[12px] text-black/35 flex items-center gap-1.5">
            <BarChart2 size={12} />
            请至少选择 2 个{regionType === 'area' ? '大区' : regionType === 'province' ? '省份' : '城市'}开始对比（最多 12 个）
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
          <span className="text-[13px] text-black/45">加载对比数据中…</span>
        </div>
      )}

      {!loading && compareData && (
        <div className="space-y-4 animate-slide-up">
          <div className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-600 text-black/80">{selected.join(' · ')}</h2>
                <p className="text-[13px] text-black/40 mt-0.5">
                  {dimConfig?.label} 分布对比
                  {dimConfig?.isMultiSelect && ' · 多选题，各项之和 = 100%'}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {compareData.regions.map(r => (
                  <span key={r.region} className="badge-ios badge-gray text-[11px]">
                    {r.region} n={r.sampleCount}
                  </span>
                ))}
              </div>
            </div>
            <StackedBarChart data={compareData} config={chartConfig} chartHeight={chartSize.height} maxBarWidth={chartSize.maxBarWidth} />
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#AF52DE]" />
                <span className="text-[14px] font-600 text-black/70">AI 对比洞察</span>
                {compareData.insightCached && <span className="badge-ios badge-gray text-[10px]">缓存</span>}
              </div>
              <button onClick={refreshInsight} disabled={insightLoading}
                className="flex items-center gap-1 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors">
                <RefreshCw size={11} className={insightLoading ? 'animate-spin' : ''} />重新生成
              </button>
            </div>
            {insightLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-black/40">
                <Loader2 size={13} className="animate-spin" />正在生成洞察…
              </div>
            ) : compareData.insight ? (
              <p className="text-[14px] text-black/65 leading-relaxed">{compareData.insight}</p>
            ) : (
              <p className="text-[13px] text-black/35 italic">洞察生成失败，请点击重新生成</p>
            )}
          </div>

          <div className="glass-card p-5">
            <h3 className="text-[14px] font-600 text-black/65 mb-3">数据明细</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-black/08">
                    <th className="text-left py-2 pr-4 text-black/40 font-500">{dimConfig?.label}</th>
                    {compareData.regions.map(r => (
                      <th key={r.region} className="text-right py-2 px-3 text-black/55 font-600 whitespace-nowrap">
                        {r.region}
                        <span className="block text-[10px] text-black/30 font-400">n={r.sampleCount}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 明细表显示时按大→小（自然逻辑）顺序，与堆积图相反 */}
                  {[...compareData.allLabels].reverse().map(label => {
                    const pcts = compareData.regions.map(r => r.distribution.find(d => d.label === label)?.percentage ?? 0);
                    const maxPct = Math.max(...pcts);
                    return (
                      <tr key={label} className="border-b border-black/04 hover:bg-black/02 transition-colors">
                        <td className="py-2 pr-4 text-black/65">{label}</td>
                        {compareData.regions.map((r, ri) => (
                          <td key={r.region} className={cn('py-2 px-3 text-right tabular-nums',
                            pcts[ri] === maxPct && pcts[ri] > 0 ? 'text-[#007AFF] font-600' : 'text-black/50')}>
                            {pcts[ri].toFixed(1)}%
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
