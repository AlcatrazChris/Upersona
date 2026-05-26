'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { useRef } from 'react';

type OrderStatus = 'all' | '锁单/提车' | '未锁单' | '退单';
const STATUS_OPTIONS: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'all',      label: '全部用户',   color: '#007AFF' },
  { value: '锁单/提车', label: '锁单/提车', color: '#34C759' },
  { value: '未锁单',   label: '未锁单',     color: '#FF9500' },
  { value: '退单',     label: '退单',       color: '#FF3B30' },
];

interface AreaStat {
  area: string;
  n: number;
  dims: Record<string, { label: string; pct: number; diff: number }[]>;
}

interface PortraitData {
  areas: string[];
  areaStats: AreaStat[];
  nationalTops: Record<string, { label: string; pct: number }[]>;
  dims: { key: string; label: string }[];
  totalSamples: number;
}

function StatusSelect({ value, onChange }: { value: OrderStatus; onChange: (v: OrderStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const current = STATUS_OPTIONS.find(o => o.value === value)!;

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setStyle({ position: 'fixed', left: r.left, top: r.bottom + 4, minWidth: r.width, zIndex: 99999 });
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <>
      <button ref={ref} onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-ios text-[12px] glass-card-subtle no-tap"
        style={{ color: current.color }}>
        <span className="font-600">{current.label}</span>
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && typeof window !== 'undefined' && createPortal(
        <div style={style} className="glass-card-elevated py-1 animate-scale-in shadow-ios-xl">
          {STATUS_OPTIONS.map(o => (
            <button key={o.value} onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); }}
              className={cn('w-full px-3 py-2 text-[12px] text-left transition-colors no-tap',
                value === o.value ? 'font-600 bg-black/04' : 'text-black/60 hover:bg-black/03')}
              style={{ color: value === o.value ? o.color : undefined }}>
              {o.label}
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}

export function AreaPortraitTable() {
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('all');
  const [data, setData]               = useState<PortraitData | null>(null);
  const [aiResult, setAiResult]       = useState<{ areas: Record<string, string[]>; common: string } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setData(null); setAiResult(null);
    try {
      const res = await fetch(`/api/area-portrait?orderStatus=${encodeURIComponent(orderStatus)}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setData(json);
    } finally { setLoading(false); }
  }, [orderStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateAI = useCallback(async (noCache = false) => {
    if (!data) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/area-portrait-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaStats: data.areaStats,
          nationalTops: data.nationalTops,
          dims: data.dims,
          orderStatus,
          noCache,
        }),
      });
      const json = await res.json();
      if (res.ok) setAiResult(json.result);
    } finally { setAiLoading(false); }
  }, [data, orderStatus]);

  // 数据加载完自动生成 AI
  useEffect(() => { if (data && !aiResult) generateAI(); }, [data]); // eslint-disable-line

  if (loading) {
    return (
      <div className="glass-card p-8">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-10 w-full" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { areas, areaStats, nationalTops, dims } = data;

  return (
    <div className="glass-card p-5 space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-600 text-black/80">用户画像区域差异化特征</h3>
          <p className="text-[12px] text-black/35 mt-0.5">各大区与全国均值的显著偏差（↑↓表示偏差 &gt;5%）</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelect value={orderStatus} onChange={setOrderStatus} />
          <button onClick={() => generateAI(true)} disabled={aiLoading || !data}
            className="flex items-center gap-1 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors">
            <RefreshCw size={11} className={aiLoading ? 'animate-spin' : ''} />刷新
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[12px] border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="text-left py-2.5 px-3 text-[12px] font-600 text-white rounded-tl-ios"
                style={{ background: '#2B5BA8', minWidth: 60 }}>区域</th>
              {areas.map((area, i) => (
                <th key={area}
                  className={cn('text-center py-2.5 px-3 text-[12px] font-600 text-white', i === areas.length - 1 && 'rounded-tr-ios')}
                  style={{ background: '#2B5BA8' }}>
                  {area}
                  <div className="text-[10px] font-400 opacity-70 mt-0.5">
                    n={areaStats.find(a => a.area === area)?.n ?? 0}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dims.map((dim, dimIdx) => {
              const isEven = dimIdx % 2 === 0;
              return (
                <tr key={dim.key} className={isEven ? 'bg-[#EBF2FF]' : 'bg-white'}>
                  <td className="py-2.5 px-3 font-600 text-[#2B5BA8] border-r border-[#C8D8F0] whitespace-nowrap align-top">
                    {dim.label}
                    <div className="text-[10px] font-400 text-black/40 mt-0.5">
                      全国：{nationalTops[dim.key]?.[0]?.label}({nationalTops[dim.key]?.[0]?.pct}%)
                    </div>
                  </td>
                  {areas.map(area => {
                    const stat = areaStats.find(a => a.area === area);
                    const items = stat?.dims[dim.key] ?? [];
                    return (
                      <td key={area} className="py-2.5 px-3 text-black/70 border-r border-[#C8D8F0] align-top">
                        {items.slice(0, 2).map((item, i) => (
                          <div key={i} className={cn('leading-relaxed', i > 0 && 'mt-0.5')}>
                            <span className={cn(
                              'font-500',
                              item.diff > 10 ? 'text-[#2B5BA8]' :
                              item.diff < -10 ? 'text-[#FF3B30]' : 'text-black/65'
                            )}>
                              {item.label}
                            </span>
                            <span className="text-black/45 ml-1">{item.pct}%</span>
                            {Math.abs(item.diff) > 5 && (
                              <span className={cn('ml-1 text-[10px] font-600',
                                item.diff > 0 ? 'text-[#2B5BA8]' : 'text-[#FF3B30]')}>
                                {item.diff > 0 ? `↑${item.diff}%` : `↓${Math.abs(item.diff)}%`}
                              </span>
                            )}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* AI 洞察区域 */}
      <div className="border-t border-black/08 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={13} className="text-[#AF52DE]" />
          <span className="text-[13px] font-600 text-black/70">AI 差异化特征总结</span>
        </div>

        {aiLoading ? (
          <div className="flex items-center gap-2 text-[13px] text-black/40 py-2">
            <Loader2 size={13} className="animate-spin" />正在分析各大区差异化特征…
          </div>
        ) : aiResult ? (
          <div className="space-y-3">
            {/* AI 大区特征 */}
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[12px] border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-[11px] font-600 text-white"
                      style={{ background: '#1a4a9f', minWidth: 60 }}>区域特征</th>
                    {areas.map(area => (
                      <th key={area} className="text-center py-2 px-3 text-[11px] font-600 text-white"
                        style={{ background: '#1a4a9f' }}>{area}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 显示最多 5 行特征 */}
                  {Array.from({ length: Math.max(...areas.map(a => (aiResult.areas[a] ?? []).length)) }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-[#EBF2FF]' : 'bg-white'}>
                      <td className="py-2 px-3 text-[#2B5BA8] font-500 border-r border-[#C8D8F0]">
                        特征 {i + 1}
                      </td>
                      {areas.map(area => {
                        const feat = (aiResult.areas[area] ?? [])[i];
                        return (
                          <td key={area} className="py-2 px-3 text-black/65 border-r border-[#C8D8F0] leading-relaxed">
                            {feat || <span className="text-black/20">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* 共性行 */}
                  {aiResult.common && (
                    <tr className="bg-[#F5F5F5]">
                      <td className="py-2.5 px-3 font-600 text-black/60 border-r border-[#C8D8F0]">共性</td>
                      <td colSpan={areas.length} className="py-2.5 px-3 text-black/55 italic">
                        {aiResult.common}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
