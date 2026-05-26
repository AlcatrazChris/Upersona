'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, AlertCircle, Sparkles, RefreshCw,
  ChevronDown, Filter, Edit3, Save, Eye, LayoutGrid, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { RegionCascade } from '@/components/RegionCascade';
import { PROFILE_DIMENSIONS } from '@/types';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

const DIMS = PROFILE_DIMENSIONS.filter(d => !['competing_models'].includes(d.key as string));
const ALL_STATUSES = ['锁单/提车', '未锁单', '退单'];
const STATUS_COLORS: Record<string, string> = {
  '锁单/提车': '#34C759', '未锁单': '#FF9500', '退单': '#FF3B30',
};

// ── Y 轴 Tick：截断 + SVG title tooltip ─────────────────────
function ScrollTick({ x, y, payload, width = 86 }: {
  x?: number; y?: number; payload?: { value: string }; width?: number;
}) {
  const text  = payload?.value ?? '';
  // 估算可显示的字符数（中文约11px/字，英文约6px）
  const avgW  = /[一-龥]/.test(text) ? 11 : 7;
  const maxCh = Math.floor(width / avgW);
  const display = text.length > maxCh ? text.slice(0, maxCh - 1) + '…' : text;

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{text}</title>
      <text x={-4} y={0} dy={4} textAnchor="end"
        fill="rgba(0,0,0,0.60)" fontSize={11}>
        {display}
      </text>
    </g>
  );
}

// ── 维度下拉 ──────────────────────────────────────────────────
function DimSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
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

// ── 簇状图（自适应高度，每张图独立 domain）────────────────────
function ClusteredChart({ data, activeStatuses }: {
  data: StatusCompareData; activeStatuses: string[];
}) {
  const { rows, allLabels } = data;
  const n = allLabels.length;
  const barsPerGroup = activeStatuses.length;
  const barSize      = 14;
  const groupH       = barsPerGroup * (barSize + 3) + 8;
  const chartH       = Math.max(200, n * groupH + 60);

  // 把 statusCounts 数组转成 Recharts 需要的平铺格式
  const chartData = rows.map(row => {
    const entry: Record<string, string | number> = { label: row.label };
    for (const s of row.statusCounts) entry[s.status] = s.pct;
    return entry;
  });

  return (
    <div style={{ height: chartH }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical"
          margin={{ left: 0, right: 46, top: 8, bottom: 8 }}
          barCategoryGap="18%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.28)' }}
            axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="label" width={92}
            tick={<ScrollTick width={88} />}
            axisLine={false} tickLine={false} interval={0} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="glass-card-elevated px-3 py-2 text-[11px] min-w-[140px]">
                  <div className="font-600 text-black/75 mb-1.5">{label}</div>
                  {payload.map((p, i: number) => {
                    const name = String(p.name ?? '');
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-sm" style={{ background: STATUS_COLORS[name] }} />
                          <span className="text-black/55">{name}</span>
                        </div>
                        <span className="font-600 tabular-nums">{Number(p.value ?? 0).toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          />
          <Legend formatter={v => <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.50)' }}>{v}</span>} />
          {ALL_STATUSES.filter(s => activeStatuses.includes(s)).map(status => (
            <Bar key={status} dataKey={status} name={status}
              fill={STATUS_COLORS[status]} fillOpacity={0.82}
              barSize={barSize} radius={[0, 3, 3, 0]}
              label={{
                position: 'right',
                formatter: (v: number) => v >= 3 ? `${Math.round(v)}%` : '',
                style: { fontSize: 10, fill: 'rgba(0,0,0,0.38)' },
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 概览卡片（每张图独立 domain = 自身最大值）────────────────
function OverviewDimCard({ dimData, activeStatuses }: {
  dimData: { dimKey: string; dimLabel: string; rows: Record<string, string|number>[]; allLabels: string[] };
  activeStatuses: string[];
}) {
  const { rows, allLabels, dimLabel } = dimData;
  const n = allLabels.length;
  const barSize  = 12;
  const groupH   = activeStatuses.length * (barSize + 3) + 8;
  const chartH   = Math.max(160, n * groupH + 48);

  // 该图自身最大值
  const maxVal = Math.max(
    1,
    ...rows.flatMap(r =>
      activeStatuses.map(s => Number(r[s] ?? 0))
    )
  );
  const domainMax = Math.min(100, Math.ceil(maxVal / 10) * 10 + 5);

  return (
    <div className="glass-card p-4">
      <div className="text-[13px] font-600 text-black/65 mb-2">{dimLabel}</div>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical"
            margin={{ left: 0, right: 40, top: 2, bottom: 2 }}
            barCategoryGap="18%" barGap={2}>
            <XAxis type="number" domain={[0, domainMax]}
              tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.25)' }}
              axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="label" width={88}
              tick={<ScrollTick width={84} />}
              axisLine={false} tickLine={false} interval={0} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="glass-card-elevated px-2.5 py-2 text-[11px] min-w-[130px]">
                    <div className="font-600 text-black/70 mb-1">{label}</div>
                    {payload.map((p, i: number) => {
                      const name = String(p.name ?? '');
                      return (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm" style={{ background: STATUS_COLORS[name] }} />
                            <span className="text-black/50">{name}</span>
                          </div>
                          <span className="font-600 tabular-nums">{Number(p.value ?? 0).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            />
            {ALL_STATUSES.filter(s => activeStatuses.includes(s)).map(status => (
              <Bar key={status} dataKey={status} name={status}
                fill={STATUS_COLORS[status]} fillOpacity={0.82}
                barSize={barSize} radius={[0, 3, 3, 0]}
                label={{
                  position: 'right',
                  formatter: (v: number) => v >= 3 ? `${Math.round(v)}%` : '',
                  style: { fontSize: 9, fill: 'rgba(0,0,0,0.35)' },
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 数据表格 ──────────────────────────────────────────────────
function DataTable({ rows, statusGroups, activeStatuses }: {
  rows: StatusCompareData['rows'];
  statusGroups: { key: string; color: string }[];
  activeStatuses: string[];
}) {
  const visible = statusGroups.filter(sg => activeStatuses.includes(sg.key));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-black/08">
            <th className="text-left py-2 pr-4 text-black/40 font-500">取值</th>
            <th className="text-right py-2 px-3 text-black/40 font-500">样本数</th>
            {visible.map(sg => (
              <th key={sg.key} className="text-right py-2 px-3 font-600 whitespace-nowrap"
                style={{ color: sg.color }}>{sg.key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const vis = row.statusCounts.filter(s => activeStatuses.includes(s.status));
            const maxPct = Math.max(...vis.map(s => s.pct));
            return (
              <tr key={row.label} className="border-b border-black/04 hover:bg-black/02 transition-colors">
                <td className="py-2 pr-4 text-black/70 font-500">{row.label}</td>
                <td className="py-2 px-3 text-right text-black/40 tabular-nums">{row.total}</td>
                {vis.map(s => (
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
  dimension: string; dimensionLabel: string; isMultiSelect: boolean;
  allLabels: string[];
  rows: { label: string; total: number; statusCounts: { status: string; count: number; pct: number }[] }[];
  totalSamples: number;
  globalStatus: { status: string; count: number; pct: number }[];
  statusGroups: { key: string; color: string }[];
  filter: { area?: string; province?: string; city?: string };
  pctNote: string;
}

interface DimsData {
  dims: { dimKey: string; dimLabel: string; rows: Record<string, string|number>[]; allLabels: string[] }[];
  statusGroups: { key: string; color: string }[];
  totalSamples: number;
}

// ── AI 洞察面板（可编辑）─────────────────────────────────────
function InsightPanel({
  insight, customText, prefer = 'ai', editing, editDraft, savingCustom, insightLoading,
  onEdit, onDraftChange, onSave, onCancelEdit, onRegenerate, onSwitchPrefer, label, hideRegenerate = false,
}: {
  insight: string; customText: string; prefer?: 'ai' | 'custom'; editing: boolean;
  editDraft: string; savingCustom: boolean; insightLoading: boolean;
  onEdit: () => void; onDraftChange: (v: string) => void;
  onSave: () => void; onCancelEdit: () => void; onRegenerate: () => void;
  onSwitchPrefer?: (p: 'ai' | 'custom') => void;
  label: string; hideRegenerate?: boolean;
}) {
  const displayText = (prefer === 'custom' && customText) ? customText : insight;
  const showPreferToggle = !hideRegenerate && !!onSwitchPrefer && !!(insight && customText);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#AF52DE]" />
          <span className="text-[14px] font-600 text-black/70">数据洞察</span>
          <span className="text-[12px] text-black/35">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {showPreferToggle && (
            <div className="flex items-center gap-0.5 glass-card-subtle p-0.5 rounded-full">
              <button onClick={() => onSwitchPrefer('ai')}
                className={cn('px-2 py-0.5 rounded-full text-[11px] font-500 transition-all no-tap',
                  prefer === 'ai' ? 'bg-white shadow-sm text-[#AF52DE]' : 'text-black/35 hover:text-black/55')}>
                AI
              </button>
              <button onClick={() => onSwitchPrefer('custom')}
                className={cn('px-2 py-0.5 rounded-full text-[11px] font-500 transition-all no-tap',
                  prefer === 'custom' ? 'bg-white shadow-sm text-[#007AFF]' : 'text-black/35 hover:text-black/55')}>
                自定义
              </button>
            </div>
          )}
          {!editing && !hideRegenerate && (
            <button onClick={onRegenerate} disabled={insightLoading}
              className="flex items-center gap-1 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors">
              <RefreshCw size={11} className={insightLoading ? 'animate-spin' : ''} />
              {insight ? '重新生成' : '生成洞察'}
            </button>
          )}
        </div>
      </div>

      {insightLoading ? (
        <div className="flex items-center gap-2 text-[13px] text-black/40 py-2">
          <Loader2 size={13} className="animate-spin" />正在分析…
        </div>
      ) : editing ? (
        <div className="space-y-3">
          <textarea value={editDraft} onChange={e => onDraftChange(e.target.value)} rows={6}
            className="w-full rounded-ios border border-black/10 bg-white/60 px-3 py-2.5 text-[13px] text-black/70 leading-relaxed resize-y focus:outline-none focus:border-[#007AFF]/40 transition-all"
            placeholder="输入自定义洞察内容…" />
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onCancelEdit} className="text-[12px] text-black/35 hover:text-black/60">取消</button>
            <button onClick={onSave} disabled={savingCustom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#007AFF] text-white font-500 disabled:opacity-50">
              <Save size={11} />{savingCustom ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      ) : displayText ? (
        <div>
          {displayText.split('\n\n').filter(Boolean).map((p, i) => (
            <p key={i} className="text-[13px] text-black/65 leading-relaxed mb-2">{p.trim()}</p>
          ))}
          {prefer === 'custom' && customText && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-black/25">
              <Eye size={10} />显示自定义内容
            </div>
          )}
        </div>
      ) : hideRegenerate ? (
        <div className="py-3 text-[13px] text-black/35 text-center">
          暂无内容，请前往数据管理中配置概览洞察
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-[13px] text-black/35 mb-3">点击"生成洞察"开始分析</p>
        </div>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────
export default function StatusComparePage() {
  const [activeTab, setActiveTab]         = useState<'overview' | 'detail'>('overview');

  // 概览 Tab
  const [dimsData, setDimsData]           = useState<DimsData | null>(null);
  const [dimsLoading, setDimsLoading]     = useState(false);
  const [overviewActive, setOverviewActive] = useState<string[]>(ALL_STATUSES);
  // 概览 AI
  const [ovInsight, setOvInsight]         = useState('');
  const [ovCustom, setOvCustom]           = useState('');
  const [ovPrefer, setOvPrefer]           = useState<'ai'|'custom'>('ai');
  const [ovEditing, setOvEditing]         = useState(false);
  const [ovDraft, setOvDraft]             = useState('');
  const [ovSaving, setOvSaving]           = useState(false);
  const [ovLoading, setOvLoading]         = useState(false);

  // 维度对比 Tab
  const [dim, setDim]                     = useState(DIMS[0].key as string);
  const [filter, setFilter]               = useState<{ area?: string; province?: string; city?: string }>({});
  const [activeStatuses, setActiveStatuses] = useState<string[]>(ALL_STATUSES);
  const [data, setData]                   = useState<StatusCompareData | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  // 维度 AI
  const [insight, setInsight]             = useState('');
  const [customText, setCustomText]       = useState('');
  const [prefer, setPrefer]               = useState<'ai'|'custom'>('ai');
  const [editing, setEditing]             = useState(false);
  const [editDraft, setEditDraft]         = useState('');
  const [savingCustom, setSavingCustom]   = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [cacheKey, setCacheKey]           = useState('');
  const prevKey = useRef('');

  // ── 概览数据 ──
  useEffect(() => {
    setDimsLoading(true);
    fetch('/api/overview-dimensions', { cache: 'no-store' })
      .then(r => r.json()).then(setDimsData).finally(() => setDimsLoading(false));
    // 自动读取概览洞察（用固定 key，不需要用户点"生成"）
    fetch('/api/status-compare-insight?isOverview=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setOvInsight(d.insight ?? d.displayText ?? '');
        setOvCustom(d.custom ?? '');
        setOvPrefer(d.prefer ?? 'ai');
      })
      .catch(() => {});
  }, []);

  // ── 概览 AI ──
  async function loadOverviewInsight(force = false) {
    setOvLoading(true);
    try {
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isOverview: true,
          dimensionLabel: '全维度概览',
          filter: '全国',
          rows: [],
          globalStatus: [],
          forceRegenerate: force,
        }),
      });
      const json = await res.json();
      setOvInsight(json.insight ?? json.displayText ?? '');
      setOvCustom(json.custom ?? '');
      setOvPrefer(json.prefer ?? 'ai');
    } finally { setOvLoading(false); }
  }

  async function saveOverviewCustom() {
    setOvSaving(true);
    try {
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isOverview: true,
          dimensionLabel: '全维度概览', filter: '全国',
          rows: [], globalStatus: [], saveCustom: true, customText: ovDraft,
        }),
      });
      const json = await res.json();
      setOvCustom(json.custom ?? ovDraft);
      setOvPrefer(json.prefer ?? 'custom');
    } finally {
      setOvEditing(false); setOvSaving(false);
    }
  }

  // ── 维度对比数据 ──
  const fetchData = useCallback(async () => {
    const key = [dim, filter.area, filter.province, filter.city].join('|');
    if (key === prevKey.current) return;
    prevKey.current = key;
    setLoading(true); setError(''); setData(null);
    setInsight(''); setCustomText(''); setPrefer('ai'); setCacheKey('');
    try {
      const params = new URLSearchParams({ dim });
      if (filter.city)          params.set('city', filter.city);
      else if (filter.province) params.set('province', filter.province);
      else if (filter.area)     params.set('area', filter.area);
      const res = await fetch(`/api/status-compare?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      // 自动从缓存加载已有的洞察内容（含 prefer 配置），无需用户手动点"生成洞察"
      const filterLabel = filter.city || filter.province || filter.area || '全国';
      const k = `status_insight:${json.dimensionLabel}:${filterLabel}:${(json.rows as { label: string }[]).map(r => r.label).join(',')}`;
      setCacheKey(k);
      try {
        const insightRes = await fetch(`/api/status-compare-insight?cacheKey=${encodeURIComponent(k)}`);
        const insightJson = await insightRes.json();
        if (insightJson.cached) {
          setInsight(insightJson.insight ?? '');
          setCustomText(insightJson.custom ?? '');
          setPrefer(insightJson.prefer ?? 'ai');
        }
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally { setLoading(false); }
  }, [dim, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── 维度 AI ──
  async function generateInsight(force = false) {
    if (!data) return;
    setInsightLoading(true);
    const filterLabel = filter.city || filter.province || filter.area || '全国';
    try {
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensionLabel: data.dimensionLabel, filter: filterLabel,
          rows: data.rows, globalStatus: data.globalStatus, forceRegenerate: force,
        }),
      });
      const json = await res.json();
      setInsight(json.insight ?? ''); setCustomText(json.custom ?? ''); setPrefer(json.prefer ?? 'ai');
      const k = `status_insight:${data.dimensionLabel}:${filterLabel}:${data.rows.map((r: { label: string }) => r.label).join(',')}`;
      setCacheKey(k);
    } finally { setInsightLoading(false); }
  }

  async function saveCustom() {
    if (!data || !cacheKey) return;
    setSavingCustom(true);
    const filterLabel = filter.city || filter.province || filter.area || '全国';
    try {
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensionLabel: data.dimensionLabel, filter: filterLabel,
          rows: data.rows, globalStatus: data.globalStatus,
          saveCustom: true, customText: editDraft,
        }),
      });
      const json = await res.json();
      setCustomText(json.custom ?? editDraft);
      setPrefer(json.prefer ?? 'custom');
    } finally {
      setEditing(false); setSavingCustom(false);
    }
  }

  async function switchPrefer(p: 'ai' | 'custom') {
    if (!data || !cacheKey) return;
    const filterLabel = filter.city || filter.province || filter.area || '全国';
    const res = await fetch('/api/status-compare-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dimensionLabel: data.dimensionLabel, filter: filterLabel,
        rows: data.rows, globalStatus: data.globalStatus,
        savePrefer: true, prefer: p,
      }),
    });
    const json = await res.json();
    setPrefer(json.prefer ?? p);
  }

  function toggleStatus(s: string) {
    setActiveStatuses(prev => prev.includes(s) ? prev.length > 1 ? prev.filter(x => x !== s) : prev : [...prev, s]);
  }

  const filterLabel = filter.city || filter.province || filter.area || '全国';

  return (
    <div className="space-y-5">
      {/* Tab 切换 */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 glass-card-subtle p-1 rounded-ios">
            <button onClick={() => setActiveTab('overview')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-500 transition-all no-tap',
                activeTab === 'overview' ? 'bg-white shadow-ios-sm text-black/80' : 'text-black/45 hover:text-black/65')}>
              <LayoutGrid size={13} />概览
            </button>
            <button onClick={() => setActiveTab('detail')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-500 transition-all no-tap',
                activeTab === 'detail' ? 'bg-white shadow-ios-sm text-black/80' : 'text-black/45 hover:text-black/65')}>
              <BarChart2 size={13} />维度对比
            </button>
          </div>

          {/* 订单状态点选（两个 Tab 共用） */}
          <div className="flex items-center gap-2">
            {ALL_STATUSES.map(s => {
              const active = (activeTab === 'overview' ? overviewActive : activeStatuses).includes(s);
              return (
                <button key={s}
                  onClick={() => activeTab === 'overview' ? setOverviewActive(prev => prev.includes(s) ? prev.length > 1 ? prev.filter(x => x !== s) : prev : [...prev, s]) : toggleStatus(s)}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-500 transition-all no-tap border',
                    active ? 'text-white border-transparent' : 'bg-white/60 border-black/10 text-black/35')}
                  style={active ? { background: STATUS_COLORS[s] } : {}}>
                  <div className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-white/80' : 'bg-current opacity-40')} />
                  {s}
                </button>
              );
            })}
          </div>

          {/* 维度对比 Tab 的额外控件 */}
          {activeTab === 'detail' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-black/40">维度</span>
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
                <span className="ml-auto text-[12px] text-black/35 tabular-nums">
                  {filterLabel} · <span className="font-600 text-black/55">{data.totalSamples.toLocaleString()}</span> 人
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 概览 Tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-slide-up">
          {dimsLoading ? (
            <div className="glass-card p-12 flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-[#007AFF]" />
              <span className="text-[13px] text-black/45">加载中…</span>
            </div>
          ) : dimsData && dimsData.dims.length > 0 ? (
            <>
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[15px] font-600 text-black/75">各维度订单状态对比</h3>
                    <p className="text-[12px] text-black/35 mt-0.5">各订单状态组内的维度分布占比，X轴以各图自身最大值为基准</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dimsData.dims.map(dim => (
                    <OverviewDimCard key={dim.dimKey} dimData={dim} activeStatuses={overviewActive} />
                  ))}
                </div>
              </div>
              <InsightPanel
                insight={ovInsight} customText={ovCustom} prefer={ovPrefer}
                editing={ovEditing} editDraft={ovDraft} savingCustom={ovSaving} insightLoading={ovLoading}
                label="各维度整体差异分析（内容由数据管理配置）"
                hideRegenerate
                onEdit={() => {}}
                onDraftChange={() => {}}
                onSave={() => {}}
                onCancelEdit={() => {}}
                onRegenerate={() => {}}
              />
            </>
          ) : null}
        </div>
      )}

      {/* ── 维度对比 Tab ── */}
      {activeTab === 'detail' && (
        <div className="space-y-5 animate-slide-up">
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
            <>
              <div className="glass-card p-4 flex items-center gap-6 flex-wrap">
                <span className="text-[12px] text-black/40">三组样本量</span>
                {data.globalStatus.map(s => (
                  <div key={s.status} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
                    <span className={cn('text-[13px]', activeStatuses.includes(s.status) ? 'text-black/60' : 'text-black/25')}>
                      {s.status}</span>
                    <span className="text-[13px] font-600 tabular-nums"
                      style={{ color: activeStatuses.includes(s.status) ? STATUS_COLORS[s.status] : 'rgba(0,0,0,0.2)' }}>
                      {s.pct}%
                    </span>
                    <span className="text-[11px] text-black/30">({s.count}人)</span>
                  </div>
                ))}
              </div>

              <div className="glass-card p-5">
                <div className="mb-3">
                  <h2 className="text-[15px] font-600 text-black/75">{data.dimensionLabel} — 各订单状态内部分布</h2>
                  <p className="text-[12px] text-black/35 mt-0.5">
                    {data.isMultiSelect ? '多选题·各项之和=100%' : '同一订单状态列内各取值之和≈100%'}
                  </p>
                </div>
                <ClusteredChart data={data} activeStatuses={activeStatuses} />
              </div>

              <div className="glass-card p-5">
                <h3 className="text-[14px] font-600 text-black/65 mb-3">数据明细</h3>
                <DataTable rows={data.rows} statusGroups={data.statusGroups} activeStatuses={activeStatuses} />
              </div>

              <InsightPanel
                insight={insight} customText={customText} prefer={prefer}
                editing={editing} editDraft={editDraft} savingCustom={savingCustom} insightLoading={insightLoading}
                label={`「${data.dimensionLabel}」锁单与退单差异`}
                onEdit={() => { setEditDraft(customText || insight); setEditing(true); }}
                onDraftChange={setEditDraft}
                onSave={saveCustom}
                onCancelEdit={() => setEditing(false)}
                onRegenerate={() => generateInsight(!insight ? false : true)}
                onSwitchPrefer={switchPrefer}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
