'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, Sparkles, RefreshCw, ChevronDown, Filter } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend,
} from 'recharts';
import { RegionCascade } from '@/components/RegionCascade';
import { PROFILE_DIMENSIONS } from '@/types';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

const DIMS = PROFILE_DIMENSIONS.filter(d => !['competing_models'].includes(d.key as string));

const STATUS_COLORS: Record<string, string> = {
  '锁单/提车': '#34C759',
  '未锁单':    '#FF9500',
  '退单':      '#FF3B30',
};
const ALL_STATUSES = ['锁单/提车', '未锁单', '退单'];

// ── 维度下拉 ─────────────────────────────────────────────────
function DimSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref    = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const current = DIMS.find(d => d.key === value);

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setStyle({ position: 'fixed', left: r.left, top: r.bottom + 4, minWidth: r.width, maxHeight: 300, zIndex: 99999 });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <>
      <button ref={ref} onClick={() => setOpen(p => !p)}
        className={cn('flex items-center gap-2 px-3 py-2 rounded-ios text-[13px] transition-all no-tap',
          open ? 'bg-[#007AFF]/12 text-[#007AFF] border border-[#007AFF]/20' : 'glass-card-subtle text-black/65')}>
        <span className="font-500">{current?.label ?? '选择维度'}</span>
        {current?.isMultiSelect && <span className="badge-ios badge-blue text-[9px]">多选</span>}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && typeof window !== 'undefined' && createPortal(
        <div ref={menuRef} style={style}
          className="glass-card-elevated py-1.5 animate-scale-in shadow-ios-xl overflow-y-auto">
          {DIMS.map(d => (
            <button key={d.key as string}
              onMouseDown={e => { e.preventDefault(); onChange(d.key as string); setOpen(false); }}
              className={cn('w-full flex items-center justify-between px-3 py-2 text-[13px] transition-colors no-tap',
                value === d.key ? 'text-[#007AFF] font-500 bg-[#007AFF]/06' : 'text-black/65 hover:bg-black/04')}>
              {d.label}
              {d.isMultiSelect && <span className="badge-ios badge-blue text-[9px] ml-2">多选</span>}
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}

// ── 自定义 Tooltip ────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { count_锁单: number; count_未锁单: number; count_退单: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-elevated px-3 py-2.5 text-[12px] min-w-[160px]">
      <div className="font-600 text-black/75 mb-2">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_COLORS[p.name] }} />
            <span className="text-black/60">{p.name}</span>
          </div>
          <span className="font-600 tabular-nums">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── 簇状条形图 ────────────────────────────────────────────────
function ClusteredChart({ data, activeStatuses }: {
  data: StatusCompareData;
  activeStatuses: string[];
}) {
  const { rows, allLabels } = data;

  // 转为 recharts 需要的格式：每行=一个维度取值，字段=各状态占比
  const chartData = allLabels.map(label => {
    const row = rows.find(r => r.label === label);
    if (!row) return { label };
    const entry: Record<string, string | number> = { label };
    for (const s of row.statusCounts) {
      entry[s.status] = s.pct;
    }
    return entry;
  });

  const barSize = Math.max(8, Math.min(20, Math.floor(180 / (allLabels.length * activeStatuses.length))));
  const chartHeight = Math.max(280, allLabels.length * 52 + 60);

  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 4, right: 56, top: 8, bottom: 8 }}
          barCategoryGap="25%"
          barGap={3}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'rgba(0,0,0,0.30)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={90}
            tick={{ fontSize: 12, fill: 'rgba(0,0,0,0.60)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Legend
            formatter={v => <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>{v}</span>}
          />
          {ALL_STATUSES.filter(s => activeStatuses.includes(s)).map(status => (
            <Bar
              key={status}
              dataKey={status}
              name={status}
              fill={STATUS_COLORS[status]}
              fillOpacity={0.82}
              barSize={barSize}
              radius={[0, 3, 3, 0]}
              label={{
                position: 'right',
                formatter: (v: number) => v > 0 ? `${v.toFixed(0)}%` : '',
                style: { fontSize: 10, fill: 'rgba(0,0,0,0.40)' },
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 数据表格 ──────────────────────────────────────────────────
function DataTable({ rows, statusGroups, activeStatuses }: {
  rows: StatusCompareData['rows'];
  statusGroups: { key: string; color: string }[];
  activeStatuses: string[];
}) {
  const visibleGroups = statusGroups.filter(sg => activeStatuses.includes(sg.key));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-black/08">
            <th className="text-left py-2 pr-4 text-black/40 font-500">取值</th>
            <th className="text-right py-2 px-3 text-black/40 font-500">样本数</th>
            {visibleGroups.map(sg => (
              <th key={sg.key} className="text-right py-2 px-3 font-600 whitespace-nowrap"
                style={{ color: sg.color }}>{sg.key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const visible = row.statusCounts.filter(s => activeStatuses.includes(s.status));
            const maxPct  = Math.max(...visible.map(s => s.pct));
            return (
              <tr key={row.label} className="border-b border-black/04 hover:bg-black/02 transition-colors">
                <td className="py-2 pr-4 text-black/70 font-500">{row.label}</td>
                <td className="py-2 px-3 text-right text-black/40 tabular-nums">{row.total}</td>
                {visible.map(s => (
                  <td key={s.status}
                    className={cn('py-2 px-3 text-right tabular-nums',
                      s.pct === maxPct && s.pct > 0 ? 'font-600' : 'text-black/50')}
                    style={{ color: s.pct === maxPct && s.pct > 0 ? STATUS_COLORS[s.status] : undefined }}>
                    {s.pct.toFixed(1)}%
                    <span className="text-black/25 text-[10px] ml-1">({s.count})</span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 接口类型 ──────────────────────────────────────────────────
interface StatusCompareData {
  dimension: string;
  dimensionLabel: string;
  isMultiSelect: boolean;
  allLabels: string[];
  rows: { label: string; total: number; statusCounts: { status: string; count: number; pct: number }[] }[];
  totalSamples: number;
  globalStatus: { status: string; count: number; pct: number }[];
  statusGroups: { key: string; color: string }[];
  filter: { area?: string; province?: string; city?: string };
  pctNote: string;
}

// ── 主页面 ────────────────────────────────────────────────────
export default function StatusComparePage() {
  const [dim, setDim]                 = useState(DIMS[0].key as string);
  const [filter, setFilter]           = useState<{ area?: string; province?: string; city?: string }>({});
  const [activeStatuses, setActiveStatuses] = useState<string[]>(ALL_STATUSES);
  const [data, setData]               = useState<StatusCompareData | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [insight, setInsight]         = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightGenerated, setInsightGenerated] = useState(false);
  const prevKey = useRef('');

  const fetchData = useCallback(async () => {
    const key = [dim, filter.area, filter.province, filter.city].join('|');
    if (key === prevKey.current) return;
    prevKey.current = key;
    setLoading(true); setError(''); setData(null); setInsight(''); setInsightGenerated(false);
    try {
      const params = new URLSearchParams({ dim });
      if (filter.city)          params.set('city', filter.city);
      else if (filter.province) params.set('province', filter.province);
      else if (filter.area)     params.set('area', filter.area);
      const res = await fetch(`/api/status-compare?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally { setLoading(false); }
  }, [dim, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function generateInsight() {
    if (!data) return;
    setInsightLoading(true); setInsight('');
    try {
      const filterLabel = filter.city || filter.province || filter.area || '全国';
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensionLabel: data.dimensionLabel,
          filter: filterLabel,
          rows: data.rows,
          globalStatus: data.globalStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setInsight(json.insight);
      setInsightGenerated(true);
    } catch (e) {
      setInsight(`生成失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally { setInsightLoading(false); }
  }

  function toggleStatus(s: string) {
    setActiveStatuses(prev =>
      prev.includes(s)
        ? prev.length > 1 ? prev.filter(x => x !== s) : prev  // 至少保留一个
        : [...prev, s]
    );
  }

  const filterLabel = filter.city || filter.province || filter.area || '全国';
  const dimConfig = DIMS.find(d => d.key === dim);

  return (
    <div className="space-y-5">
      {/* 控制区 */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-black/40">对比维度</span>
            <DimSelect value={dim} onChange={v => { setDim(v); prevKey.current = ''; }} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-black/35" />
            <RegionCascade value={filter} onChange={setFilter} />
            {(filter.area || filter.province || filter.city) && (
              <button onClick={() => { setFilter({}); prevKey.current = ''; }}
                className="text-[12px] text-[#007AFF]">清除</button>
            )}
          </div>
          {data && (
            <div className="ml-auto text-[13px] text-black/40 tabular-nums">
              <span className="font-500 text-black/65">{filterLabel}</span>
              {' · 总样本 '}
              <span className="font-500 text-black/65">{data.totalSamples.toLocaleString()}</span> 人
            </div>
          )}
        </div>

        {/* 订单状态点选 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-black/40">订单状态</span>
          {ALL_STATUSES.map(s => {
            const active = activeStatuses.includes(s);
            return (
              <button key={s} onClick={() => toggleStatus(s)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-500 transition-all no-tap border',
                  active ? 'text-white border-transparent shadow-sm' : 'bg-white/60 border-black/10 text-black/40'
                )}
                style={active ? { background: STATUS_COLORS[s] } : {}}>
                <div className={cn('w-2 h-2 rounded-full transition-all',
                  active ? 'bg-white/80' : 'bg-current opacity-40')} />
                {s}
              </button>
            );
          })}
          <span className="text-[11px] text-black/30 ml-1">点击切换显示</span>
        </div>

        <div className="text-[11px] text-black/35">
          纵轴为「{dimConfig?.label ?? '维度'}」的各取值，横轴为各订单状态在该组内的占比（同一订单状态列合计≈100%）
        </div>
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
          <span className="text-[13px] text-black/45">加载中…</span>
        </div>
      )}

      {!loading && data && (
        <div className="space-y-5 animate-slide-up">
          {/* 三组样本量 */}
          <div className="glass-card p-4 flex items-center gap-6 flex-wrap">
            <span className="text-[12px] text-black/40">三组样本量</span>
            {data.globalStatus.map(s => (
              <div key={s.status} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
                <span className={cn('text-[13px]', activeStatuses.includes(s.status) ? 'text-black/60' : 'text-black/25')}>
                  {s.status}
                </span>
                <span className="text-[13px] font-600 tabular-nums"
                  style={{ color: activeStatuses.includes(s.status) ? STATUS_COLORS[s.status] : 'rgba(0,0,0,0.2)' }}>
                  {s.pct}%
                </span>
                <span className="text-[11px] text-black/30">({s.count}人)</span>
              </div>
            ))}
          </div>

          {/* 簇状条形图 */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-600 text-black/75">
                  {data.dimensionLabel} — 各订单状态内部分布
                </h2>
                <p className="text-[12px] text-black/35 mt-0.5">
                  {data.isMultiSelect ? '多选题·各项之和=100%' : '同一订单状态列内各取值之和≈100%'}
                </p>
              </div>
            </div>
            <ClusteredChart data={data} activeStatuses={activeStatuses} />
          </div>

          {/* 数据明细表 */}
          <div className="glass-card p-5">
            <h3 className="text-[14px] font-600 text-black/65 mb-3">数据明细</h3>
            <DataTable rows={data.rows} statusGroups={data.statusGroups} activeStatuses={activeStatuses} />
          </div>

          {/* AI 洞察 */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#AF52DE]" />
                <span className="text-[14px] font-600 text-black/70">AI 洞察</span>
                <span className="text-[12px] text-black/35">锁单用户与退单用户的差异分析</span>
              </div>
              {insightGenerated && (
                <button onClick={generateInsight} disabled={insightLoading}
                  className="flex items-center gap-1 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors">
                  <RefreshCw size={11} className={insightLoading ? 'animate-spin' : ''} />重新生成
                </button>
              )}
            </div>
            {insightLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-black/40">
                <Loader2 size={13} className="animate-spin" />正在分析差异…
              </div>
            ) : insight ? (
              <div className="space-y-3">
                {insight.split('\n\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="text-[14px] text-black/65 leading-relaxed">{para.trim()}</p>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-[13px] text-black/35 mb-3">
                  分析「{data.dimensionLabel}」维度下锁单用户与退单用户的本质差异
                </p>
                <button onClick={generateInsight} className="btn-ios btn-primary text-[13px]">
                  <Sparkles size={13} />生成 AI 洞察
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
