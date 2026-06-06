'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, AlertCircle, Sparkles, RefreshCw,
  ChevronDown, Filter, Edit3, Save, LayoutGrid, BarChart2, GitCompare, EyeOff,
  Download, ImageDown,
} from 'lucide-react';
import { exportSVG, exportPNG } from '@/lib/chartExport';
// Note: Loader2 still used in DimCard loading state
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { RegionCascade } from '@/components/RegionCascade';
import { ChartConfigPanel } from '@/components/charts/ChartConfigPanel';
import { useRole } from '@/components/RoleProvider';
import { PROFILE_DIMENSIONS, type DimensionConfig } from '@/types';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { ChartConfig, DEFAULT_CHART_CONFIG, loadChartConfig, saveChartConfig } from '@/lib/chartConfig';

interface DataVersion {
  version_id: number;
  uploaded_at: string;
  record_count: number;
  is_active: boolean;
  notes?: string | null;
  version_name?: string | null;
}

function getVersionName(v: DataVersion) {
  return v.version_name || v.notes || `v${v.version_id}`;
}

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

// ── 多维度选择器 ──────────────────────────────────────────────
const MAX_DIMS = 4;

function DimMultiSelect({
  selected, onChange, dims,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  dims: DimensionConfig[];
}) {
  const [open, setOpen] = useState(false);
  const ref    = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setStyle({ position: 'fixed', left: r.left, top: r.bottom + 4, minWidth: Math.max(r.width, 220), maxHeight: 360, zIndex: 99999 });
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

  function toggle(key: string) {
    if (selected.includes(key)) {
      if (selected.length > 1) onChange(selected.filter(k => k !== key));
    } else {
      if (selected.length < MAX_DIMS) onChange([...selected, key]);
    }
  }

  const labels = selected.map(k => dims.find(d => d.key === k)?.label ?? k).join('、');

  return (
    <>
      <button ref={ref} onClick={() => setOpen(p => !p)}
        className={cn('flex items-center gap-2 px-3 py-2 rounded-ios text-[13px] transition-all no-tap',
          open ? 'bg-[#007AFF]/12 text-[#007AFF] border border-[#007AFF]/20' : 'glass-card-subtle text-black/65')}>
        <span className="font-500 truncate max-w-[200px]">{labels || '选择维度'}</span>
        <span className="text-[10px] text-black/35 flex-shrink-0">{selected.length}/{MAX_DIMS}</span>
        <ChevronDown size={11} className={cn('flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && typeof window !== 'undefined' && createPortal(
        <div ref={menuRef} style={style}
          className="glass-card-elevated py-1.5 animate-scale-in shadow-ios-xl overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-black/06">
            <span className="text-[11px] text-black/35">最多选 {MAX_DIMS} 个维度同时展示</span>
          </div>
          {dims.map(d => {
            const isSelected = selected.includes(d.key as string);
            const disabled   = !isSelected && selected.length >= MAX_DIMS;
            return (
              <button key={d.key as string}
                onMouseDown={e => { e.preventDefault(); toggle(d.key as string); }}
                disabled={disabled}
                className={cn('w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors no-tap',
                  isSelected ? 'text-[#007AFF] bg-[#007AFF]/06' : disabled ? 'text-black/25 cursor-not-allowed' : 'text-black/65 hover:bg-black/04')}>
                <div className={cn('w-4 h-4 rounded flex items-center justify-center border transition-all flex-shrink-0',
                  isSelected ? 'bg-[#007AFF] border-[#007AFF]' : 'border-black/20')}>
                  {isSelected && <svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3l2.5 2.5L8 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span>{d.label}</span>
                {d.isMultiSelect && <span className="badge-ios badge-blue text-[9px] ml-auto">多选</span>}
              </button>
            );
          })}
        </div>, document.body
      )}
    </>
  );
}

// ── 簇状图（自适应高度，支持图表配置 + 样本数显示）────────────
function ClusteredChart({ data, activeStatuses, cfg = DEFAULT_CHART_CONFIG }: {
  data: StatusCompareData; activeStatuses: string[]; cfg?: ChartConfig;
}) {
  const { rows, allLabels } = data;
  const n = allLabels.length;
  const barsPerGroup = activeStatuses.length;
  const barSize      = 14;
  const groupH       = barsPerGroup * (barSize + 3) + 8;
  const chartH       = Math.max(200, n * groupH + 60);

  // 样本数查找表（label → total）
  const sampleMap = Object.fromEntries(rows.map(r => [r.label, r.total]));

  const chartData = rows.map(row => {
    const entry: Record<string, string | number> = { label: row.label };
    for (const s of row.statusCounts) entry[s.status] = s.pct;
    return entry;
  });

  // Y 轴宽度：显示样本数时加宽
  const yW = cfg.showSampleCount ? 118 : 92;

  // 自定义 Y 轴 Tick（支持样本数附注）
  const SampleTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
    const text  = payload?.value ?? '';
    const count = sampleMap[text];
    const avgW  = /[一-龥]/.test(text) ? 11 : 7;
    const maxCh = Math.floor((yW - (cfg.showSampleCount ? 36 : 4)) / avgW);
    const display = text.length > maxCh ? text.slice(0, maxCh - 1) + '…' : text;
    return (
      <g transform={`translate(${x},${y})`}>
        <title>{text}</title>
        <text x={-4} y={0} dy={4} textAnchor="end" fill="rgba(0,0,0,0.60)" fontSize={cfg.axisFontSize ?? 11}>
          {display}
          {cfg.showSampleCount && count !== undefined && (
            <tspan fill="rgba(0,0,0,0.30)" fontSize={9}>{` ${count}`}</tspan>
          )}
        </text>
      </g>
    );
  };

  return (
    <div style={{ height: chartH }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical"
          margin={{ left: 0, right: 46, top: 8, bottom: 8 }}
          barCategoryGap="18%" barGap={2}>
          {cfg.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />}
          {cfg.showXAxis && (
            <XAxis type="number" domain={[0, 100]}
              tick={{ fontSize: cfg.axisFontSize, fill: 'rgba(0,0,0,0.28)' }}
              axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
          )}
          {cfg.showYAxis && (
            <YAxis type="category" dataKey="label" width={yW}
              tick={<SampleTick />}
              axisLine={false} tickLine={false} interval={0} />
          )}
          {cfg.showTooltip && (
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const total = sampleMap[label as string];
                return (
                  <div className="glass-card-elevated px-3 py-2 text-[11px] min-w-[140px]">
                    <div className="font-600 text-black/75 mb-1.5">
                      {label}
                      {total !== undefined && <span className="text-black/35 font-400 ml-1">n={total}</span>}
                    </div>
                    {payload.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-sm" style={{ background: STATUS_COLORS[String(p.name ?? '')] }} />
                          <span className="text-black/55">{p.name}</span>
                        </div>
                        <span className="font-600 tabular-nums">{Number(p.value ?? 0).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                );
              }}
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            />
          )}
          {cfg.showLegend && (
            <Legend formatter={v => <span style={{ fontSize: cfg.legendFontSize, color: 'rgba(0,0,0,0.50)' }}>{v}</span>} />
          )}
          {ALL_STATUSES.filter(s => activeStatuses.includes(s)).map(status => (
            <Bar key={status} dataKey={status} name={status}
              fill={STATUS_COLORS[status]} fillOpacity={cfg.barOpacity}
              barSize={barSize} radius={[0, cfg.barRadius, cfg.barRadius, 0]}
              label={cfg.showLabel ? {
                position: 'right',
                formatter: (v: number) => v >= 3 ? `${Math.round(v)}%` : '',
                style: { fontSize: cfg.labelFontSize, fill: 'rgba(0,0,0,0.38)' },
              } : false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 概览卡片（每张图独立 domain = 自身最大值，支持图表配置 + 管理员隐藏）──
function OverviewDimCard({ dimData, activeStatuses, cfg = DEFAULT_CHART_CONFIG, onHide }: {
  dimData: {
    dimKey: string;
    dimLabel: string;
    rows: Record<string, string|number>[];
    allLabels: string[];
    statusSampleCounts?: Record<string, number>;
  };
  activeStatuses: string[];
  cfg?: ChartConfig;
  onHide?: (dimKey: string) => void;
}) {
  const role    = useRole();
  const isAdmin = role === 'admin';
  const cardRef = useRef<HTMLDivElement>(null);

  const { rows, allLabels, dimLabel } = dimData;
  const n = allLabels.length;
  const barSize  = 12;
  const groupH   = activeStatuses.length * (barSize + 3) + 8;
  const chartH   = Math.max(160, n * groupH + 48);
  const sampleCount = activeStatuses.reduce((sum, status) => (
    sum + Number(dimData.statusSampleCounts?.[status] ?? 0)
  ), 0);

  const maxVal = Math.max(1, ...rows.flatMap(r => activeStatuses.map(s => Number(r[s] ?? 0))));
  const domainMax = Math.min(100, Math.ceil(maxVal / 10) * 10 + 5);

  function handleHide() {
    onHide?.(dimData.dimKey);
  }

  return (
    <div ref={cardRef} className="glass-card p-4 relative group">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[13px] font-600 text-black/65">{dimLabel}</div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-black/35 whitespace-nowrap">
            样本数 <span className="font-600 text-black/55 tabular-nums">{sampleCount.toLocaleString()}</span>
          </div>
          {/* 管理员导出 + 隐藏按钮 */}
          {isAdmin && (
            <>
              <button
                onClick={() => exportSVG(cardRef.current, dimLabel)}
                title="导出 SVG"
                className="p-1.5 rounded-lg transition-all no-tap opacity-0 group-hover:opacity-100 bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55"
              >
                <Download size={10} />
              </button>
              <button
                onClick={() => exportPNG(cardRef.current, dimLabel)}
                title="导出 PNG（2× 高清）"
                className="p-1.5 rounded-lg transition-all no-tap opacity-0 group-hover:opacity-100 bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55"
              >
                <ImageDown size={10} />
              </button>
              {onHide && (
                <button
                  onClick={handleHide}
                  title="从状态对比中隐藏此字段（可在数据管理中重新开启）"
                  className={cn(
                    'p-1.5 rounded-lg transition-all no-tap opacity-0 group-hover:opacity-100',
                    'bg-black/05 hover:bg-[#FF3B30]/12 text-black/30 hover:text-[#FF3B30]',
                  )}
                >
                  <EyeOff size={11} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical"
            margin={{ left: 0, right: cfg.showLabel ? 40 : 8, top: 2, bottom: 2 }}
            barCategoryGap="18%" barGap={2}>
            {cfg.showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
            )}
            {cfg.showXAxis && (
              <XAxis type="number" domain={[0, domainMax]}
                tick={{ fontSize: cfg.axisFontSize - 2, fill: 'rgba(0,0,0,0.25)' }}
                axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            )}
            {cfg.showYAxis && (
              <YAxis type="category" dataKey="label" width={88}
                tick={<ScrollTick width={84} />}
                axisLine={false} tickLine={false} interval={0} />
            )}
            {cfg.showTooltip && (
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="glass-card-elevated px-2.5 py-2 text-[11px] min-w-[130px]">
                      <div className="font-600 text-black/70 mb-1">{label}</div>
                      {payload.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm" style={{ background: STATUS_COLORS[String(p.name ?? '')] }} />
                            <span className="text-black/50">{p.name}</span>
                          </div>
                          <span className="font-600 tabular-nums">{Number(p.value ?? 0).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              />
            )}
            {ALL_STATUSES.filter(s => activeStatuses.includes(s)).map(status => (
              <Bar key={status} dataKey={status} name={status}
                fill={STATUS_COLORS[status]} fillOpacity={cfg.barOpacity}
                barSize={barSize} radius={[0, cfg.barRadius, cfg.barRadius, 0]}
                label={cfg.showLabel ? {
                  position: 'right',
                  formatter: (v: number) => v >= 3 ? `${Math.round(v)}%` : '',
                  style: { fontSize: cfg.labelFontSize - 2, fill: 'rgba(0,0,0,0.35)' },
                } : false}
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
  rows: { label: string; total: number; statusCounts: { status: string; count: number; groupTotal: number; pct: number }[] }[];
  totalSamples: number;   // 有效样本数（排除空白）
  rawSamples?:  number;   // 原始总数（含空白）
  globalStatus: { status: string; count: number; totalCount?: number; pct: number }[];
  statusGroups: { key: string; color: string }[];
  filter: { area?: string; province?: string; city?: string };
  pctNote: string;
}

interface DimsData {
  dims: {
    dimKey: string;
    dimLabel: string;
    rows: Record<string, string|number>[];
    allLabels: string[];
    statusSampleCounts?: Record<string, number>;
  }[];
  statusGroups: { key: string; color: string }[];
  totalSamples: number;
  versionId?: number;
}

// ── AI 洞察面板（可编辑）────────────────────────────────────────
function InsightPanel({
  insight, customText, prefer = 'ai', editing, editDraft, savingCustom, insightLoading,
  onEdit, onDraftChange, onSave, onCancelEdit,
  onGenerate,   // 首次生成（所有用户可触发）
  onRegenerate, // 强制重新生成（管理员专用）
  label, noAI = false,
}: {
  insight: string; customText: string; prefer?: 'ai' | 'custom'; editing: boolean;
  editDraft: string; savingCustom: boolean; insightLoading: boolean;
  onEdit: () => void; onDraftChange: (v: string) => void;
  onSave: () => void; onCancelEdit: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  label: string;
  noAI?: boolean;
}) {
  const role = useRole();
  const isAdmin = role === 'admin';

  // noAI 模式：只显示 customText；普通模式：prefer 决定显示哪个
  const displayText = noAI ? customText : (prefer === 'custom' && customText ? customText : insight);
  const hasContent  = !!displayText;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#AF52DE]" />
          <span className="text-[14px] font-600 text-black/70">数据洞察</span>
          <span className="text-[12px] text-black/35">{label}</span>
          {/* 普通 AI 模式才显示徽章（有内容时） */}
          {!noAI && !editing && hasContent && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-500',
              prefer === 'custom' && customText
                ? 'bg-[#007AFF]/10 text-[#007AFF]'
                : 'bg-[#AF52DE]/10 text-[#AF52DE]'
            )}>
              {prefer === 'custom' && customText ? '自定义' : 'AI'}
            </span>
          )}
        </div>
        {/* 管理员专用控制：编辑 + 强制重新生成（仅在有内容时显示） */}
        {isAdmin && hasContent && !editing && (
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="flex items-center gap-1 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors">
              <Edit3 size={11} />编辑
            </button>
            {!noAI && (
              <button
                onClick={onRegenerate}
                disabled={insightLoading || (prefer === 'custom' && !!customText)}
                title={prefer === 'custom' && !!customText ? '当前为自定义模式，如需重新生成请先切换回 AI 模式' : ''}
                className={cn(
                  'flex items-center gap-1 text-[12px] transition-colors',
                  prefer === 'custom' && !!customText
                    ? 'text-black/20 cursor-not-allowed'
                    : 'text-black/35 hover:text-[#007AFF]'
                )}>
                <RefreshCw size={11} className={insightLoading ? 'animate-spin' : ''} />重新生成
              </button>
            )}
          </div>
        )}
      </div>

      {insightLoading ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <Loader2 size={20} className="animate-spin text-[#5856D6]" />
          <span className="text-[13px] text-black/40">AI 正在生成洞察，首次约需 5-10 秒…</span>
        </div>
      ) : editing && isAdmin ? (
        <div className="space-y-3">
          <textarea value={editDraft} onChange={e => onDraftChange(e.target.value)} rows={6}
            className="w-full rounded-ios border border-black/10 bg-white/60 px-3 py-2.5 text-[13px] text-black/70 leading-relaxed resize-y focus:outline-none focus:border-[#007AFF]/40 transition-all"
            placeholder="输入洞察内容…保存后直接显示" />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-black/30">保存后直接显示；清空内容保存可删除</p>
            <div className="flex items-center gap-2">
              <button onClick={onCancelEdit} className="text-[12px] text-black/35 hover:text-black/60">取消</button>
              <button onClick={onSave} disabled={savingCustom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#007AFF] text-white font-500 disabled:opacity-50">
                <Save size={11} />{savingCustom ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : hasContent ? (
        <div>
          {displayText.split('\n\n').filter(Boolean).map((p, i) => (
            <p key={i} className="text-[13px] text-black/65 leading-relaxed mb-2">{p.trim()}</p>
          ))}
        </div>
      ) : noAI ? (
        /* noAI 模式（概览）：仅管理员可设置，客户看提示 */
        <div className="text-center py-4">
          <p className="text-[13px] text-black/35 mb-2">暂无洞察内容</p>
          {isAdmin && (
            <button onClick={onEdit}
              className="flex items-center gap-1.5 mx-auto text-[12px] text-black/40 hover:text-[#007AFF] transition-colors">
              <Edit3 size={12} />点击编辑内容
            </button>
          )}
        </div>
      ) : (
        /* 普通 AI 模式空状态：所有用户均可触发首次生成 */
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-[13px] text-black/35">暂无 AI 洞察内容</p>
          <button onClick={onGenerate} disabled={insightLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-ios text-[13px] bg-[#5856D6] text-white font-500 hover:bg-[#4846C0] transition-colors disabled:opacity-50 no-tap">
            <Sparkles size={13} />生成洞察
          </button>
          {isAdmin && (
            <button onClick={onEdit}
              className="text-[11px] text-black/30 hover:text-[#007AFF] transition-colors">
              或编辑自定义内容
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 工具：旧格式城市级别标签 → 新格式 ────────────────────────
const CITY_TIER_LEGACY: Record<string, string> = {
  '一线': '一线城市', '新一线': '新一线城市',
  '二线': '二线城市', '三线': '三线城市', '四线及以下': '四线及以下城市',
};

function normalizeCmpLabels(data: StatusCompareData, dimKey: string): StatusCompareData {
  if (dimKey !== 'city_tier') return data;
  return {
    ...data,
    rows: data.rows.map(r => ({
      ...r,
      label: CITY_TIER_LEGACY[r.label] ?? r.label,
    })),
  };
}

// ── 工具：将 compareData 的行顺序对齐到 refLabels（当前版本的排序）──
// 对有序维度（如城市级别、年龄段）保证两个版本 Y 轴完全一致，便于视觉比对
function alignDataToLabels(compareData: StatusCompareData, refLabels: string[]): StatusCompareData {
  const rowMap = new Map(compareData.rows.map(r => [r.label, r]));
  // 按 refLabels 顺序重排，缺失的补零行
  const aligned = refLabels.map(label =>
    rowMap.get(label) ?? {
      label,
      total: 0,
      statusCounts: compareData.statusGroups.map(sg => ({ status: sg.key, count: 0, groupTotal: 0, pct: 0 })),
    }
  );
  // 同时把 compareData 中有但 refLabels 没有的标签追加到末尾（避免数据丢失）
  const refSet = new Set(refLabels);
  for (const row of compareData.rows) {
    if (!refSet.has(row.label)) aligned.push(row);
  }
  return { ...compareData, rows: aligned, allLabels: aligned.map(r => r.label) };
}

// ── 单维度对比卡片（自包含状态，支持多实例并列）─────────────────
function DimCard({ dimKey, filter, activeStatuses, compareVersionId, chartConfig }: {
  dimKey:            string;
  filter:            { area?: string; province?: string; city?: string };
  activeStatuses:    string[];
  compareVersionId?: number | null;
  chartConfig:       ChartConfig;
}) {
  const role      = useRole();
  const isAdmin   = role === 'admin';
  const chartRef  = useRef<HTMLDivElement>(null);
  const cmpRef    = useRef<HTMLDivElement>(null);

  const [data, setData]               = useState<StatusCompareData | null>(null);
  const [compareData, setCompareData] = useState<StatusCompareData | null>(null);
  const [loading, setLoading]         = useState(false);
  const [cmpLoading, setCmpLoading]   = useState(false);
  const [error, setError]             = useState('');
  const [insight, setInsight]         = useState('');
  const [customText, setCustomText]   = useState('');
  const [prefer, setPrefer]           = useState<'ai'|'custom'>('ai');
  const [editing, setEditing]         = useState(false);
  const [editDraft, setEditDraft]     = useState('');
  const [savingCustom, setSavingCustom] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const prevKey    = useRef('');
  const prevCmpKey = useRef('');

  // 主数据
  const fetchData = useCallback(async () => {
    const key = [dimKey, filter.area, filter.province, filter.city].join('|');
    if (key === prevKey.current) return;
    prevKey.current = key;
    setLoading(true); setError(''); setData(null);
    setInsight(''); setCustomText(''); setPrefer('ai');
    try {
      const params = new URLSearchParams({ dim: dimKey });
      if (filter.city)          params.set('city', filter.city);
      else if (filter.province) params.set('province', filter.province);
      else if (filter.area)     params.set('area', filter.area);
      const res = await fetch(`/api/status-compare?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      const fl = filter.city || filter.province || filter.area || '全国';
      const ck = `status_insight:${json.dimensionLabel}:${fl}:${(json.rows as { label: string }[]).map(r => r.label).join(',')}`;
      try {
        const ir = await fetch(`/api/status-compare-insight?cacheKey=${encodeURIComponent(ck)}`, { cache: 'no-store' });
        const id = await ir.json();
        setInsight(id.insight ?? ''); setCustomText(id.custom ?? ''); setPrefer(id.prefer ?? 'ai');
      } catch {}
    } catch (e) { setError(e instanceof Error ? e.message : '请求失败'); }
    finally { setLoading(false); }
  }, [dimKey, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 历史对比数据
  useEffect(() => {
    if (!compareVersionId) { setCompareData(null); prevCmpKey.current = ''; return; }
    const key = [dimKey, compareVersionId, filter.area, filter.province, filter.city].join('|');
    if (key === prevCmpKey.current) return;
    prevCmpKey.current = key;
    setCmpLoading(true); setCompareData(null);
    const params = new URLSearchParams({ dim: dimKey, versionId: String(compareVersionId) });
    if (filter.city)          params.set('city', filter.city);
    else if (filter.province) params.set('province', filter.province);
    else if (filter.area)     params.set('area', filter.area);
    fetch(`/api/status-compare?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (!json.error) setCompareData(json); })
      .catch(() => {})
      .finally(() => setCmpLoading(false));
  }, [compareVersionId, dimKey, filter]);

  async function generateInsight(force = false) {
    if (!data || (prefer === 'custom' && customText)) return;
    setInsightLoading(true);
    const filterLabel = filter.city || filter.province || filter.area || '全国';
    try {
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensionLabel: data.dimensionLabel, filter: filterLabel,
          rows: data.rows, globalStatus: data.globalStatus, forceRegenerate: force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setInsight(json.insight ?? ''); setCustomText(json.custom ?? ''); setPrefer(json.prefer ?? 'ai');
    } catch (e) { console.error('生成洞察失败:', e); }
    finally { setInsightLoading(false); }
  }

  async function saveCustom() {
    if (!data) return;
    setSavingCustom(true);
    const filterLabel = filter.city || filter.province || filter.area || '全国';
    const res = await fetch('/api/status-compare-insight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimensionLabel: data.dimensionLabel, filter: filterLabel,
        rows: data.rows, globalStatus: data.globalStatus, saveCustom: true, customText: editDraft }),
    });
    const json = await res.json();
    setCustomText(json.custom ?? editDraft); setPrefer(json.prefer ?? 'custom');
    setEditing(false); setSavingCustom(false);
  }

  if (error) return (
    <div className="glass-card p-4 flex items-center gap-2 border border-[#FF3B30]/20">
      <AlertCircle size={14} className="text-[#FF3B30]" />
      <span className="text-[13px] text-black/65">{error}</span>
    </div>
  );

  if (loading) return (
    <div className="glass-card p-12 flex flex-col items-center gap-3">
      <Loader2 size={22} className="animate-spin text-[#007AFF]" />
      <span className="text-[13px] text-black/45">加载中…</span>
    </div>
  );

  if (!data) return null;

  // 仅显示当前激活的订单状态的 globalStatus
  const activeGlobalStatus = data.globalStatus.filter(s => activeStatuses.includes(s.status));

  return (
    <div className="space-y-4">
      {/* 当前版本图表 */}
      <div ref={chartRef} className="glass-card p-5 relative group">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-[15px] font-600 text-black/75">{data.dimensionLabel} — 各订单状态内部分布</h2>
            <p className="text-[12px] text-black/35 mt-0.5">
              {data.isMultiSelect ? '多选题·各项之和=100%' : '同一订单状态列内各取值之和≈100%'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <>
                <button
                  onClick={() => exportSVG(chartRef.current, data.dimensionLabel)}
                  title="导出 SVG"
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55 transition-all no-tap"
                >
                  <Download size={10} />
                </button>
                <button
                  onClick={() => exportPNG(chartRef.current, data.dimensionLabel)}
                  title="导出 PNG（2× 高清）"
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55 transition-all no-tap"
                >
                  <ImageDown size={10} />
                </button>
              </>
            )}
            <ChartConfigPanel
              config={chartConfig}
              onChange={c => saveChartConfig('status-compare', c)}
            />
          </div>
        </div>
        <ClusteredChart data={data} activeStatuses={activeStatuses} cfg={chartConfig} />
      </div>

      {/* 历史版本对比图表 */}
      {compareVersionId && (
        <div ref={cmpRef} className="glass-card p-5 border border-[#5856D6]/15 relative group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <GitCompare size={13} className="text-[#5856D6]" />
              <span className="text-[13px] font-600 text-black/65">v{compareVersionId} 历史对比</span>
              <span className="text-[11px] text-black/30">{data.dimensionLabel}</span>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => exportSVG(cmpRef.current, `${data.dimensionLabel}-v${compareVersionId}`)}
                  title="导出 SVG"
                  className="p-1.5 rounded-lg bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55 transition-all no-tap"
                >
                  <Download size={10} />
                </button>
                <button
                  onClick={() => exportPNG(cmpRef.current, `${data.dimensionLabel}-v${compareVersionId}`)}
                  title="导出 PNG（2× 高清）"
                  className="p-1.5 rounded-lg bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55 transition-all no-tap"
                >
                  <ImageDown size={10} />
                </button>
              </div>
            )}
          </div>
          {cmpLoading ? (
            <div className="flex items-center gap-2 text-[12px] text-black/35 py-4">
              <Loader2 size={12} className="animate-spin" />历史数据加载中…
            </div>
          ) : compareData ? (
            /* 旧格式标签标准化（如"三线"→"三线城市"）+ 对齐 Y 轴顺序 */
            <ClusteredChart
              data={alignDataToLabels(normalizeCmpLabels(compareData, dimKey), data.allLabels)}
              activeStatuses={activeStatuses}
              cfg={chartConfig}
            />
          ) : (
            <p className="text-[12px] text-black/30 py-3">该版本无此维度数据</p>
          )}
        </div>
      )}

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
        onGenerate={() => generateInsight(false)}
        onRegenerate={() => generateInsight(true)}
      />
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
  const [overviewVersionId, setOverviewVersionId] = useState<number | null>(null);
  // 概览洞察（仅自定义内容，无 AI 生成）
  const [ovCustom, setOvCustom]           = useState('');
  const [ovEditing, setOvEditing]         = useState(false);
  const [ovDraft, setOvDraft]             = useState('');
  const [ovSaving, setOvSaving]           = useState(false);

  // 维度对比 Tab
  const [selectedDims, setSelectedDims] = useState<string[]>([]);
  const [filter, setFilter]                  = useState<{ area?: string; province?: string; city?: string }>({});
  const [activeStatuses, setActiveStatuses]  = useState<string[]>(ALL_STATUSES);
  const [compareVersionId, setCompareVersionId] = useState<number | null>(null);
  const [versions, setVersions]              = useState<DataVersion[]>([]);
  const [chartConfig, setChartConfig]        = useState<ChartConfig>(() => loadChartConfig('status-compare'));
  // 概览 Tab 维度过滤
  const [profileDims, setProfileDims] = useState<DimensionConfig[]>(PROFILE_DIMENSIONS.filter(d => d.key !== "competing_models"));
  const [dimsLoaded, setDimsLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/dimensions")
      .then(r => r.json()).then((data: DimensionConfig[]) => {
        if (Array.isArray(data) && data.length > 0) setProfileDims(data.filter(d => d.key !== "competing_models" && d.enabledProfile !== false));
      }).catch(() => {}).finally(() => setDimsLoaded(true));
  }, []);

  const [visibleDimKeys, setVisibleDimKeys]  = useState<string[] | null>(null); // null = 全部显示

  // ── 概览数据 + 版本列表 ──
  useEffect(() => {
    setDimsLoading(true);
    const params = new URLSearchParams();
    if (overviewVersionId) params.set('versionId', String(overviewVersionId));
    const query = params.toString();
    fetch(`/api/overview-dimensions${query ? `?${query}` : ''}`, { cache: 'no-store' })
      .then(r => r.json()).then(setDimsData).finally(() => setDimsLoading(false));
  }, [overviewVersionId]);

  useEffect(() => {
    fetch('/api/status-compare-insight?isOverview=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setOvCustom(d.custom ?? ''); })
      .catch(() => {});
    fetch('/api/versions')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setVersions(d); })
      .catch(() => {});
  }, []);

  // 管理员：从概览/画像中隐藏字段（乐观更新：立即移除，API 后台执行）
  function handleHideOverviewDim(dimKey: string) {
    setDimsData(prev => prev ? { ...prev, dims: prev.dims.filter(d => d.dimKey !== dimKey) } : prev);
    fetch('/api/dimensions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimensions: [{ dim_key: dimKey, enabled_profile: false }] }),
    }).catch(e => console.error('hide dim failed', e));
  }

  async function saveOverviewCustom() {
    setOvSaving(true);
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
    setOvEditing(false);
    setOvSaving(false);
  }

  useEffect(() => { if (dimsLoaded && profileDims.length > 0 && selectedDims.length === 0) setSelectedDims([profileDims[0].key as string]); }, [dimsLoaded, profileDims, selectedDims]);

  function toggleStatus(s: string) {
    setActiveStatuses(prev => prev.includes(s) ? prev.length > 1 ? prev.filter(x => x !== s) : prev : [...prev, s]);
  }

  const filterLabel = filter.city || filter.province || filter.area || '全国';
  const activeVersion = versions.find(v => v.is_active);
  const selectedOverviewVersion = overviewVersionId
    ? versions.find(v => v.version_id === overviewVersionId)
    : activeVersion;
  const overviewSampleCount = dimsData?.dims
    .filter(d => visibleDimKeys === null || visibleDimKeys.includes(d.dimKey))
    .reduce((sum, dim) => sum + overviewActive.reduce((inner, status) => (
      inner + Number(dim.statusSampleCounts?.[status] ?? 0)
    ), 0), 0) ?? 0;

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
                <DimMultiSelect selected={selectedDims} onChange={setSelectedDims} dims={profileDims} />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={13} className="text-black/35" />
                <RegionCascade value={filter} onChange={setFilter} />
                {(filter.area || filter.province || filter.city) && (
                  <button onClick={() => setFilter({})} className="text-[12px] text-[#007AFF]">清除</button>
                )}
              </div>
              {/* 历史版本对比选择器 */}
              {versions.filter(v => !v.is_active).length > 0 && (
                <div className="flex items-center gap-1.5">
                  <GitCompare size={12} className="text-[#5856D6]" />
                  <select
                    value={compareVersionId ?? ''}
                    onChange={e => setCompareVersionId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="input-ios text-[12px] py-1 pr-6 pl-2 rounded-ios">
                    <option value="">对比历史版本</option>
                    {versions.filter(v => !v.is_active).map(v => (
                      <option key={v.version_id} value={v.version_id}>
                        {getVersionName(v)}（v{v.version_id} · {new Date(v.uploaded_at).toLocaleDateString('zh-CN')}）
                      </option>
                    ))}
                  </select>
                  {compareVersionId && (
                    <button onClick={() => setCompareVersionId(null)} className="text-[11px] text-[#007AFF]">清除</button>
                  )}
                </div>
              )}
              {/* 图表设置 */}
              <ChartConfigPanel
                config={chartConfig}
                onChange={c => {
                  setChartConfig(c);
                  saveChartConfig('status-compare', c);
                }}
              />
              <span className="ml-auto text-[12px] text-black/35">{filterLabel}</span>
            </>
          )}

          {/* 概览 Tab 历史版本选择 */}
          {activeTab === 'overview' && versions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <GitCompare size={12} className="text-[#5856D6]" />
              <select
                value={overviewVersionId ?? ''}
                onChange={e => setOverviewVersionId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="input-ios text-[12px] py-1 pr-6 pl-2 rounded-ios">
                <option value="">
                  当前概览{activeVersion ? ` · ${getVersionName(activeVersion)}` : ''}
                </option>
                {versions.filter(v => !v.is_active).map(v => (
                  <option key={v.version_id} value={v.version_id}>
                    历史概览 · {getVersionName(v)}（v{v.version_id}）
                  </option>
                ))}
              </select>
              {overviewVersionId && (
                <button onClick={() => setOverviewVersionId(null)} className="text-[11px] text-[#007AFF]">当前</button>
              )}
            </div>
          )}

          {/* 概览 Tab 维度过滤 */}
          {activeTab === 'overview' && dimsData && dimsData.dims.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] text-black/35">显示维度</span>
              {dimsData.dims.map(d => {
                const active = visibleDimKeys === null || visibleDimKeys.includes(d.dimKey);
                return (
                  <button key={d.dimKey}
                    onClick={() => {
                      if (visibleDimKeys === null) {
                        // 全显示 → 仅显示点击的
                        setVisibleDimKeys(dimsData.dims.filter(x => x.dimKey !== d.dimKey).map(x => x.dimKey));
                      } else if (visibleDimKeys.includes(d.dimKey)) {
                        const next = visibleDimKeys.filter(k => k !== d.dimKey);
                        setVisibleDimKeys(next.length === 0 ? null : next);
                      } else {
                        const next = [...visibleDimKeys, d.dimKey];
                        setVisibleDimKeys(next.length === dimsData.dims.length ? null : next);
                      }
                    }}
                    className={cn('px-2 py-0.5 rounded-full text-[11px] transition-all no-tap border',
                      active ? 'bg-[#007AFF] text-white border-transparent' : 'bg-white/60 border-black/10 text-black/40')}>
                    {d.dimLabel}
                  </button>
                );
              })}
              {visibleDimKeys !== null && (
                <button onClick={() => setVisibleDimKeys(null)} className="text-[11px] text-[#007AFF] ml-1">全部</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 概览 Tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-slide-up">
          {/* 数据洞察放最上面 */}
          <InsightPanel
            noAI
            insight="" customText={ovCustom} prefer="custom"
            editing={ovEditing} editDraft={ovDraft} savingCustom={ovSaving} insightLoading={false}
            label="各维度整体差异分析"
            onEdit={() => { setOvDraft(ovCustom); setOvEditing(true); }}
            onDraftChange={setOvDraft}
            onSave={saveOverviewCustom}
            onCancelEdit={() => setOvEditing(false)}
            onGenerate={() => {}}
            onRegenerate={() => {}}
          />
          {/* 各维度簇状图 */}
          {dimsLoading ? (
            <div className="glass-card p-12 flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-[#007AFF]" />
              <span className="text-[13px] text-black/45">加载中…</span>
            </div>
          ) : dimsData && dimsData.dims.length > 0 ? (
            <div className="glass-card p-5">
              <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-600 text-black/75">各维度订单状态对比</h3>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-500',
                      overviewVersionId ? 'bg-[#5856D6]/10 text-[#5856D6]' : 'bg-[#34C759]/10 text-[#34C759]')}>
                      {overviewVersionId ? '历史概览' : '当前概览'}
                    </span>
                    {selectedOverviewVersion && (
                      <span className="text-[11px] text-black/35">
                        {getVersionName(selectedOverviewVersion)} · v{selectedOverviewVersion.version_id}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-black/35 mt-0.5">
                    各订单状态组内维度分布占比，X 轴以各图自身最大值为基准
                    <span className="ml-2">
                      当前显示样本数 <span className="font-600 text-black/55 tabular-nums">{overviewSampleCount.toLocaleString()}</span>
                    </span>
                  </p>
                </div>
                {/* 图表设置 */}
                <ChartConfigPanel
                  config={chartConfig}
                  onChange={c => { setChartConfig(c); saveChartConfig('status-compare', c); }}
                  showLegendOption={false}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dimsData.dims
                  .filter(d => visibleDimKeys === null || visibleDimKeys.includes(d.dimKey))
                  .map(dim => (
                    <OverviewDimCard
                      key={dim.dimKey}
                      dimData={dim}
                      activeStatuses={overviewActive}
                      cfg={chartConfig}
                      onHide={handleHideOverviewDim}
                    />
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── 维度对比 Tab ── */}
      {activeTab === 'detail' && (
        <div className="space-y-5 animate-slide-up">
          {selectedDims.map(dimKey => (
            <DimCard key={`${dimKey}-${filter.city}-${filter.province}-${filter.area}`}
              dimKey={dimKey} filter={filter} activeStatuses={activeStatuses}
              compareVersionId={compareVersionId}
              chartConfig={chartConfig}
            />
          ))}
        </div>
      )}
    </div>
  );
}
