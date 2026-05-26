'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, RefreshCw, Loader2, ChevronDown, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { RegionMultiSelect } from '@/components/RegionMultiSelect';
import type { RegionType as RType } from '@/components/RegionMultiSelect';

type OrderStatus = 'all' | '锁单/提车' | '未锁单' | '退单';
type RegionType  = 'area' | 'province' | 'city';

const STATUS_OPTIONS = [
  { value: 'all' as OrderStatus,       label: '全部用户',  color: '#007AFF' },
  { value: '锁单/提车' as OrderStatus, label: '锁单/提车', color: '#34C759' },
  { value: '未锁单' as OrderStatus,    label: '未锁单',    color: '#FF9500' },
  { value: '退单' as OrderStatus,      label: '退单',      color: '#FF3B30' },
];

const REGION_TYPES = [
  { value: 'area' as RegionType,     label: '大区' },
  { value: 'province' as RegionType, label: '省份' },
  { value: 'city' as RegionType,     label: '城市' },
];

interface DimItem    { label: string; pct: number; diff: number }
interface AreaStat   { area: string; n: number; dims: Record<string, DimItem[]> }
interface PortraitData {
  areas: string[];
  areaStats: AreaStat[];
  nationalTops: Record<string, { label: string; pct: number }[]>;
  dims: { key: string; label: string }[];
  totalSamples: number;
  regionType: string;
  allAvailableAreas: string[];
  baselineLabel: string;  // '全国' 或 '选定均值'
}
interface AiResult {
  areas: Record<string, Record<string, string>>;  // 地域 → { 维度 → 描述 }
}

// ── 订单状态下拉 ──────────────────────────────────────────────
function StatusSelect({ value, onChange }: { value: OrderStatus; onChange: (v: OrderStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const current = STATUS_OPTIONS.find(o => o.value === value)!;

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setStyle({ position: 'fixed', left: r.left, top: r.bottom + 4, minWidth: 140, zIndex: 99999 });
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <>
      <button ref={ref} onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-2 rounded-ios text-[13px] glass-card-subtle no-tap"
        style={{ color: current.color }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: current.color }} />
        <span className="font-500">{current.label}</span>
        <ChevronDown size={11} className={cn('text-black/35 transition-transform', open && 'rotate-180')} />
      </button>
      {open && typeof window !== 'undefined' && createPortal(
        <div style={style} className="glass-card-elevated py-1.5 animate-scale-in shadow-ios-xl">
          {STATUS_OPTIONS.map(o => (
            <button key={o.value}
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); }}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors no-tap',
                value === o.value ? 'bg-black/04' : 'hover:bg-black/03')}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />
              <span className={cn('font-500', value === o.value ? 'text-black/80' : 'text-black/60')}>{o.label}</span>
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}

// ── 差值徽章 ─────────────────────────────────────────────────
function DiffBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 5) return null;
  const up = diff > 0;
  return (
    <span className={cn('text-[10px] font-700 ml-0.5', up ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
      {up ? `↑${diff}%` : `↓${Math.abs(diff)}%`}
    </span>
  );
}

// ── 数据表格 ─────────────────────────────────────────────────
function DataTable({ data, baselineLabel }: { data: PortraitData; baselineLabel: string }) {
  const { areas, areaStats, nationalTops, dims } = data;
  const colWidth = `${Math.floor(88 / dims.length)}%`;

  return (
    <div className="w-full">
      <table className="w-full text-[12px] border-collapse table-fixed">
        <colgroup>
          <col style={{ width: '7%' }} />
          <col style={{ width: '5%' }} />
          {dims.map((_, i) => <col key={i} style={{ width: colWidth }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="py-2.5 px-2 text-[11px] font-600 text-white text-center rounded-tl-ios"
              style={{ background: '#2B5BA8' }}>地域</th>
            <th className="py-2.5 px-2 text-[10px] font-500 text-white/80 text-center"
              style={{ background: '#2B5BA8' }}>n</th>
            {dims.map((dim, i) => (
              <th key={dim.key}
                className={cn('py-2 px-1.5 text-[10px] font-600 text-white text-center leading-tight',
                  i === dims.length - 1 && 'rounded-tr-ios')}
                style={{ background: '#2B5BA8' }}>
                <div>{dim.label}</div>
                <div className="text-[9px] font-400 text-white/55 mt-0.5">
                  {baselineLabel}:{nationalTops[dim.key]?.[0]?.label ?? '-'}({nationalTops[dim.key]?.[0]?.pct ?? 0}%)
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areaStats.map((areaStat, rowIdx) => (
            <tr key={areaStat.area} className={rowIdx % 2 === 0 ? 'bg-[#EBF2FF]' : 'bg-white'}>
              <td className="py-2.5 px-2 text-center border-r border-[#C8D8F0]">
                <div className="text-[11px] font-700 text-[#2B5BA8] leading-tight">{areaStat.area}</div>
              </td>
              <td className="py-2.5 px-1 text-center text-[10px] text-black/40 tabular-nums border-r border-[#C8D8F0]">
                {areaStat.n}
              </td>
              {dims.map(dim => {
                const items = areaStat.dims[dim.key] ?? [];
                return (
                  <td key={dim.key} className="py-2 px-1.5 border-r border-[#C8D8F0] align-top">
                    {items[0] && (
                      <div className="leading-tight">
                        <span className={cn('text-[11px] font-600',
                          items[0].diff > 10 ? 'text-[#34C759]' : items[0].diff < -10 ? 'text-[#FF3B30]' : 'text-black/70')}>
                          {items[0].label}
                        </span>
                        <span className="text-[10px] text-black/40 ml-0.5">{items[0].pct}%</span>
                        <DiffBadge diff={items[0].diff} />
                      </div>
                    )}
                    {items[1] && (
                      <div className="mt-0.5 leading-tight">
                        <span className="text-[10px] text-black/50">{items[1].label}</span>
                        <span className="text-[10px] text-black/30 ml-0.5">{items[1].pct}%</span>
                        <DiffBadge diff={items[1].diff} />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-5 mt-2.5 px-1 text-[10px] text-black/35">
        <span><span className="text-[#34C759] font-700">↑绿</span> 高于全国5%+</span>
        <span><span className="text-[#FF3B30] font-700">↓红</span> 低于全国5%+</span>
        <span>字体深色=偏差10%+</span>
      </div>
    </div>
  );
}

// ── AI 特征总结表（4行固定维度）──────────────────────────────
const AI_DIMS = ['职业', '年龄', '学历', '收入', '家庭结构', '消费观念', '对比车型'];
const AI_DIM_COLORS = ['#5856D6', '#007AFF', '#AF52DE', '#34C759', '#FF9500', '#FF2D55', '#32ADE6'];

function AiTable({ aiResult, areas }: { aiResult: AiResult; areas: string[] }) {
  const colWidth = `${Math.floor(88 / areas.length)}%`;

  return (
    <div className="w-full">
      <table className="w-full text-[12px] border-collapse table-fixed">
        <colgroup>
          <col style={{ width: '12%' }} />
          {areas.map((_, i) => <col key={i} style={{ width: colWidth }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="py-2.5 px-2 text-[11px] font-600 text-white text-center rounded-tl-ios"
              style={{ background: '#1a4a9f' }}>维度</th>
            {areas.map((area, i) => (
              <th key={area}
                className={cn('py-2.5 px-2.5 text-[11px] font-600 text-white text-center',
                  i === areas.length - 1 && 'rounded-tr-ios')}
                style={{ background: '#1a4a9f' }}>
                {area}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AI_DIMS.map((dim, dimIdx) => (
            <tr key={dim} className={dimIdx % 2 === 0 ? 'bg-[#EBF2FF]' : 'bg-white'}>
              <td className="py-3 px-2 border-r border-[#C8D8F0] align-middle">
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-8 rounded-full flex-shrink-0"
                    style={{ background: AI_DIM_COLORS[dimIdx] }} />
                  <span className="text-[11px] font-600"
                    style={{ color: AI_DIM_COLORS[dimIdx] }}>{dim}</span>
                </div>
              </td>
              {areas.map(area => {
                const areaData = aiResult.areas[area] ?? {};
                const text = areaData[dim];
                return (
                  <td key={area}
                    className="py-3 px-2.5 text-black/65 border-r border-[#C8D8F0] leading-relaxed text-[11px] align-top">
                    {text || <span className="text-black/20">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────
export default function AreaPortraitPage() {
  const [orderStatus,     setOrderStatus]     = useState<OrderStatus>('all');
  const [regionType,      setRegionType]      = useState<RegionType>('area');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [availableAreas,  setAvailableAreas]  = useState<string[]>([]);
  const [data,            setData]            = useState<PortraitData | null>(null);
  const [aiResult,        setAiResult]        = useState<AiResult | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [aiLoading,       setAiLoading]       = useState(false);
  const [error,           setError]           = useState('');
  const autoFired = useRef(false);

  // 省份/城市模式下，未选地域时不加载数据
  const needsSelection = (regionType === 'province' || regionType === 'city') && selectedRegions.length === 0;

  const fetchData = useCallback(async () => {
    if ((regionType === 'province' || regionType === 'city') && selectedRegions.length === 0) {
      setData(null); setAiResult(null); setError(''); autoFired.current = false;
      return;
    }
    setLoading(true); setData(null); setAiResult(null); setError(''); autoFired.current = false;
    try {
      const params = new URLSearchParams({
        orderStatus,
        regionType,
        ...(selectedRegions.length ? { regions: selectedRegions.join(',') } : {}),
      });
      const res = await fetch(`/api/area-portrait?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      if (json.allAvailableAreas) setAvailableAreas(json.allAvailableAreas);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally { setLoading(false); }
  }, [orderStatus, regionType, selectedRegions]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 初始化时预加载大区可选列表
  useEffect(() => {
    fetch(`/api/area-portrait?orderStatus=${encodeURIComponent(orderStatus)}&regionType=area&listOnly=1`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (json.allAvailableAreas) setAvailableAreas(json.allAvailableAreas); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateAI = useCallback(async (noCache = false) => {
    if (!data) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/area-portrait-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaStats: data.areaStats, nationalTops: data.nationalTops,
          dims: data.dims, orderStatus, regionType, noCache,
        }),
      });
      const json = await res.json();
      if (res.ok) setAiResult(json.result);
    } finally { setAiLoading(false); }
  }, [data, orderStatus, regionType]);

  useEffect(() => {
    // 大区模式自动触发 AI；省份/城市模式等用户手动点
    if (data && !autoFired.current && regionType === 'area') {
      autoFired.current = true;
      generateAI();
    }
  }, [data, generateAI, regionType]);

  // ── 导出 Excel ────────────────────────────────────────────
  function exportExcel() {
    if (!data || !aiResult) return;

    // 构建表格数据：行=维度，列=地域
    const AI_DIMS_EXPORT = ['职业', '年龄', '学历', '收入', '家庭结构', '消费观念', '对比车型'];

    // CSV 内容
    const headers = ['维度', ...data.areas];
    const rows = AI_DIMS_EXPORT.map(dim => {
      const row = [dim];
      for (const area of data.areas) {
        const areaData = (aiResult.areas[area] ?? {}) as Record<string, string>;
        row.push(areaData[dim] ?? '');
      }
      return row;
    });

    // 同时追加数据统计表（各维度 TOP 数据）
    const statHeaders = ['地域', '样本数', ...data.dims.map(d => d.label)];
    const statRows = data.areaStats.map(a => {
      const row: string[] = [a.area, String(a.n)];
      for (const dim of data.dims) {
        const items = a.dims[dim.key] ?? [];
        row.push(items.slice(0, 2).map(i => `${i.label}(${i.pct}%)`).join(' / '));
      }
      return row;
    });

    // 生成 CSV（UTF-8 BOM 保证 Excel 中文正常）
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push('AI差异化特征总结');
    lines.push(headers.map(escape).join(','));
    rows.forEach(r => lines.push(r.map(escape).join(',')));
    lines.push('');
    lines.push('数据统计');
    lines.push(statHeaders.map(escape).join(','));
    statRows.forEach(r => lines.push(r.map(escape).join(',')));

    const bom = '\uFEFF';
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const statusLabel = orderStatus === 'all' ? '全部用户' : orderStatus;
    const regionLabel = selectedRegions.length > 0 ? selectedRegions.join('-') : regionType === 'area' ? '全部大区' : '全部';
    a.href     = url;
    a.download = `华境S区域特征_${statusLabel}_${regionLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRegionTypeChange(v: RegionType) {
    setRegionType(v);
    setSelectedRegions([]);
    setAvailableAreas([]);
    // 预加载该地域类型的可选列表
    fetch(`/api/area-portrait?orderStatus=${encodeURIComponent(orderStatus)}&regionType=${v}&listOnly=1`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (json.allAvailableAreas) setAvailableAreas(json.allAvailableAreas); })
      .catch(() => {});
  }

  return (
    <div className="space-y-5">
      {/* 控制区 */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 地域类型切换 */}
          <div className="flex items-center gap-1 glass-card-subtle p-1 rounded-ios">
            {REGION_TYPES.map(t => (
              <button key={t.value} onClick={() => handleRegionTypeChange(t.value)}
                className={cn('px-3 py-1.5 rounded-[8px] text-[13px] font-500 transition-all no-tap',
                  regionType === t.value ? 'bg-white shadow-ios-sm text-black/80' : 'text-black/45 hover:text-black/65')}>
                {t.label}
              </button>
            ))}
          </div>

          {/* 订单状态 */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-black/40">用户类型</span>
            <StatusSelect value={orderStatus} onChange={setOrderStatus} />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {data && (
              <span className="text-[12px] text-black/35 tabular-nums">
                共 <span className="font-600 text-black/55">{data.totalSamples.toLocaleString()}</span> 人
              </span>
            )}
            <button onClick={() => generateAI(true)} disabled={aiLoading || !data}
              className="flex items-center gap-1.5 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors disabled:opacity-40">
              <RefreshCw size={11} className={aiLoading ? 'animate-spin' : ''} />
              刷新 AI
            </button>
          </div>
        </div>

        {/* 地域多选（含搜索）—— 始终显示，不依赖 data */}
        <div className="flex items-start gap-2">
          <span className="text-[13px] text-black/40 flex-shrink-0 mt-1.5">选择地域</span>
          {availableAreas.length > 0 ? (
            <RegionMultiSelect
              type={regionType as RType}
              options={availableAreas.map(a => ({ name: a, count: 0 }))}
              selected={selectedRegions}
              onChange={setSelectedRegions}
              maxSelect={12}
            />
          ) : (
            <div className="text-[13px] text-black/30 mt-1.5">加载中…</div>
          )}
        </div>

        <div className="text-[11px] text-black/35">
          ↑绿色=高于全国均值5%以上 · ↓红色=低于全国均值5%以上 · 字体深色=偏差10%以上
        </div>
      </div>

      {error && (
        <div className="glass-card p-4 text-[13px] text-[#FF3B30] flex items-center gap-2">⚠ {error}</div>
      )}

      {/* 省份/城市模式：未选地域时显示引导 */}
      {needsSelection && !loading && (
        <div className="glass-card p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#007AFF]/08 flex items-center justify-center mb-2">
            <span className="text-2xl">🗺️</span>
          </div>
          <div className="text-[16px] font-600 text-black/60">
            请选择{regionType === 'province' ? '省份' : '城市'}
          </div>
          <div className="text-[13px] text-black/35">
            从上方"选择地域"中选择1-12个{regionType === 'province' ? '省份' : '城市'}后自动展示数据
          </div>
        </div>
      )}

      {loading && (
        <div className="glass-card p-12 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-[#007AFF]" />
          <span className="text-[13px] text-black/45">加载数据中…</span>
        </div>
      )}

      {!loading && data && (
        <div className="space-y-5 animate-slide-up">
          {/* 数据表格 */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-600 text-black/75">各地域维度分布</h3>
              <span className="text-[11px] text-black/35">第一行=占比最高的取值，第二行=次高</span>
            </div>
            <DataTable data={data} baselineLabel={data.baselineLabel} />
          </div>

          {/* AI 特征总结 */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#AF52DE]" />
                <h3 className="text-[15px] font-600 text-black/75">AI 差异化特征总结</h3>
                <span className="text-[12px] text-black/35">每个地域4-6条特征，含具体数据</span>
              </div>
              <div className="flex items-center gap-3">
                {aiResult && (
                  <button onClick={exportExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#007AFF]/08 text-[#007AFF] hover:bg-[#007AFF]/15 transition-colors no-tap font-500">
                    <Download size={12} />导出 Excel
                  </button>
                )}
                {aiResult && (
                  <button onClick={() => generateAI(true)} disabled={aiLoading}
                    className="flex items-center gap-1 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors">
                    <RefreshCw size={11} className={aiLoading ? 'animate-spin' : ''} />重新生成
                  </button>
                )}
              </div>
            </div>

            {aiLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-black/40 py-6">
                <Loader2 size={14} className="animate-spin" />正在分析各地域差异化特征，请稍候…
              </div>
            ) : aiResult ? (
              <AiTable aiResult={aiResult} areas={data.areas} />
            ) : (
              <div className="text-center py-6 space-y-2">
                <p className="text-[13px] text-black/40">
                  {regionType === 'area' ? '正在准备生成…' : `已选 ${data.areas.length} 个${regionType === 'province' ? '省份' : '城市'}，点击开始分析`}
                </p>
                <button onClick={() => generateAI()}
                  className="btn-ios btn-primary text-[13px]">
                  <Sparkles size={13} />生成 AI 总结
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
