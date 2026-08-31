'use client';

import { useState, useMemo } from 'react';
import { Loader2, RefreshCw, MapPin } from 'lucide-react';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { filterRecords, getGeoOptionsWithCount, getStatusOptions, type GeoLevel } from '@/lib/filterRecords';
import { aggregateField } from '@/lib/dataAggregator';
import { computeClusters, CLUSTER_METHODS, type ClusterMethod } from '@/lib/clusterEngine';
import { useDatasetStore } from '@/store/datasetStore';
import type { ViewConfig, ClusterInsightResult, ClusterSegment, DataPoint } from '@/lib/viewConfig';
import type { Dataset, Field } from '@/types/dataSchema';
import { detectTimeField, filterByDateBlocks, getDefaultDateBlocks } from '@/lib/timeStatus';
import { useUrlArrayState, useUrlStringState } from '@/hooks/useUrlParamState';
import { StatusFilterGroups } from '@/components/shared/StatusFilterGroups';
import { GeoFilterGroup } from '@/components/shared/GeoFilterGroup';

// ── McKinsey palette (one per segment) ───────────────────────

const MK_COLORS = [
  { accent: '#003087', bg: '#edf2fb', bar: '#4a7fd4' },
  { accent: '#00533a', bg: '#edf7f2', bar: '#3da874' },
  { accent: '#6b1d3e', bg: '#faeef4', bar: '#c0507a' },
  { accent: '#4a3000', bg: '#faf5e8', bar: '#c4922a' },
] as const;

// ── Field categorisation ──────────────────────────────────────

const CLUSTER_KW      = ['年龄', '学历', '行业', '职业', '岗位', '工作状态', '工作生活', '生活状态', '收入', '单位类型'];
// '状态' 已移除：真正的订单/意向状态字段由 viewConfig.statusFieldKey 单独排除，
// '状态' 过于宽泛会误伤"工作生活状态"等核心人口统计字段。
const DISPLAY_EXCL_KW = ['大区', '省份', '城市', '地区', '意向', '订单', '阶段',
                          '号码', '姓名', '电话', '联系', '编号', 'ID', 'id'];

function categorise(dataset: Dataset, vc: ViewConfig) {
  const timeField = detectTimeField(dataset);
  const excluded = new Set(
    [vc.geoRegionKey, vc.geoProvinceKey, vc.geoCityKey, vc.statusFieldKey, timeField?.key].filter(Boolean) as string[],
  );
  const chartable = dataset.fields.filter(f =>
    !excluded.has(f.key) &&
    f.type !== 'text' &&
    f.type !== 'ranking' &&
    !DISPLAY_EXCL_KW.some(kw => f.name.includes(kw)) &&
    (f.options?.length ?? 0) > 0,
  );
  const clusterFields  = chartable.filter(f => CLUSTER_KW.some(kw => f.name.includes(kw)));
  const supplementFields = chartable.filter(f => !CLUSTER_KW.some(kw => f.name.includes(kw)));
  return { chartable, clusterFields, supplementFields };
}

function fieldDist(records: Record<string, unknown>[], field: Field) {
  const agg = aggregateField(records, field);
  const total = agg.reduce((s, d) => s + d.count, 0) || 1;
  return agg.slice(0, 6).map(d => ({
    value: d.label,
    pct:   d.count / total * 100,
    count: d.count,
  }));
}

// ── Bold text renderer (parses **text** → <strong>) ──────────

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
      : part
  );
}

// ── MiniBar ───────────────────────────────────────────────────

function MiniBar({ value, pct, bar }: { value: string; pct: number; bar: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10px] text-gray-600 w-14 truncate flex-shrink-0">{value}</div>
      <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: bar }} />
      </div>
      <div className="text-[10px] font-semibold w-10 text-right flex-shrink-0" style={{ color: bar }}>{pct.toFixed(1)}%</div>
    </div>
  );
}

// ── resolveDataPoint — looks up actual computed % for AI-selected values ──
// Prefers cluster-specific pcts (from clusterDist) over global averages.
// delta/pp values are never passed here — they stay internal to the AI pipeline.

function resolveDataPoint(
  dp: DataPoint,
  chartable: Field[],
  filteredRecords: Record<string, unknown>[],
  clusterDist?: ClusterSegment['clusterDist'],
): { name: string; entries: { value: string; pct: number }[] } | null {
  // 1. Use cluster-specific distribution when available (V2 results)
  if (clusterDist?.length) {
    const dist = clusterDist.find(d => d.fieldName === dp.field);
    if (dist?.topValues.length) {
      const distMap = new Map(dist.topValues.map(v => [v.value, v.pct]));
      const entries = dp.values
        .map(v => ({ value: v, pct: distMap.get(v) ?? 0 }))
        .filter(e => e.pct > 0);
      if (entries.length) return { name: dp.label ?? dp.field, entries };
    }
  }
  // 2. Fallback: global distribution from filteredRecords
  const field = chartable.find(f => f.name === dp.field);
  if (!field) return null;
  const all     = fieldDist(filteredRecords, field);
  const distMap = new Map(all.map(d => [d.value, d.pct]));
  const entries = dp.values
    .map(v => ({ value: v, pct: distMap.get(v) ?? 0 }))
    .filter(e => e.pct > 0);
  if (!entries.length) return null;
  return { name: dp.label ?? field.name, entries };
}

// ── DataBar — compact bar row used everywhere ─────────────────

function DataBar({ value, pct, bar, dimColor, wide }: {
  value:    string; pct: number; bar: string; dimColor?: boolean; wide?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        title={value}
        className={`text-[10px] shrink-0 leading-tight ${
          wide
            ? 'w-[5.5rem] break-words line-clamp-2'
            : 'w-[3.5rem] truncate'
        } ${dimColor ? 'text-gray-500' : 'text-gray-700'}`}
      >
        {value}
      </div>
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dimColor ? 'bg-gray-100' : 'bg-white/60'}`}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: bar }} />
      </div>
      <div
        className={`text-[10px] w-6 text-right flex-shrink-0 ${dimColor ? 'text-gray-400' : 'font-semibold'}`}
        style={dimColor ? {} : { color: bar }}
      >
        {pct.toFixed(1)}%
      </div>
    </div>
  );
}

// ── Segment card ──────────────────────────────────────────────

function SegmentCard({
  seg, index, chartable, clusterFields, filteredRecords,
}: {
  seg:             ClusterSegment;
  index:           number;
  chartable:       Field[];
  clusterFields:   Field[];
  filteredRecords: Record<string, unknown>[];
}) {
  const c   = MK_COLORS[index % MK_COLORS.length];
  const pct = seg.pct_estimate ?? seg.estimated_pct;

  type Resolved = { name: string; entries: { value: string; pct: number }[] };
  const notNull = <T,>(x: T | null): x is T => x !== null;

  // ── Left col: who_data (new) or fallback to cluster fields (legacy) ──
  const leftResolved: Resolved[] = (() => {
    if (seg.who_data?.length) {
      return seg.who_data
        .map(dp => resolveDataPoint(dp, chartable, filteredRecords, seg.clusterDist))
        .filter(notNull);
    }
    const aiDimNames = new Set(Object.keys(seg.dimensions ?? {}));
    return [
      ...clusterFields.filter(f => aiDimNames.has(f.name)),
      ...clusterFields.filter(f => !aiDimNames.has(f.name)),
    ].slice(0, 4).map(f => {
      const dist = fieldDist(filteredRecords, f).slice(0, 3);
      return dist.length ? { name: f.name, entries: dist.map(d => ({ value: d.value, pct: d.pct })) } : null;
    }).filter(notNull);
  })();

  // ── Center insight sections ──
  const hasSections = (seg.insight_sections?.length ?? 0) > 0;

  // ── Bottom: preference_data (new) or preference_fields (legacy) ──
  const prefResolved: Resolved[] = (() => {
    if (seg.preference_data?.length) {
      return seg.preference_data
        .map(dp => resolveDataPoint(dp, chartable, filteredRecords, seg.clusterDist))
        .filter(notNull);
    }
    return (seg.preference_fields ?? []).slice(0, 3).map(name => {
      const field = chartable.find(f => f.name === name);
      if (!field) return null;
      const dist = fieldDist(filteredRecords, field).slice(0, 4);
      return dist.length ? { name, entries: dist.map(d => ({ value: d.value, pct: d.pct })) } : null;
    }).filter(notNull);
  })();

  const hasBottom = prefResolved.length > 0 || !!seg.preference_intro;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
      style={{ borderLeft: `4px solid ${c.accent}` }}>

      {/* ── Header: compact, 1 row ── */}
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" style={{ background: c.bg }}>
        <span
          className="text-[9px] font-bold tracking-[0.2em] px-1.5 py-0.5 rounded-sm flex-shrink-0"
          style={{ background: `${c.accent}18`, color: c.accent }}
        >
          S{String(index + 1).padStart(2, '0')}
        </span>
        <span className="text-base font-bold text-gray-900 leading-tight">
          典型人群{index + 1}：{seg.name}
        </span>
        {pct != null && (
          <span className="text-sm font-bold flex-shrink-0" style={{ color: c.accent }}>（{Number(pct).toFixed(1)}%）</span>
        )}
        {/* Keywords inline */}
        {(seg.keywords?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1 flex-wrap ml-1">
            {seg.keywords!.map(kw => (
              <span
                key={kw}
                className="text-[10px] px-1.5 py-0.5 border border-dashed"
                style={{ borderColor: `${c.accent}55`, color: c.accent }}
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Body: left | right ── */}
      <div className="flex divide-x divide-gray-100">

        {/* Left — 他们是谁（精简：最多3字段，每字段最多3值） */}
        <div className="flex-shrink-0 px-3 py-3 space-y-2.5" style={{ width: 180, background: c.bg }}>
          {seg.who_intro && (
            <div className="text-[10px] text-gray-700 leading-snug border-b pb-2 mb-0.5"
              style={{ borderColor: `${c.accent}22` }}>
              {renderBold(seg.who_intro)}
            </div>
          )}
          {leftResolved.length > 0 ? leftResolved.slice(0, 3).map(r => (
            <div key={r.name}>
              <div className="text-[9px] font-bold tracking-wide mb-0.5" style={{ color: c.accent }}>
                {r.name}
              </div>
              <div className="space-y-0.5">
                {r.entries.slice(0, 3).map(e => (
                  <DataBar key={e.value} value={e.value} pct={e.pct} bar={c.bar} />
                ))}
              </div>
            </div>
          )) : (
            <p className="text-[10px] text-gray-300">暂无画像数据</p>
          )}
        </div>

        {/* Right: 消费心理（上）+ 购车偏好（下） */}
        <div className="flex-1 flex flex-col min-w-0 divide-y divide-gray-100">

          {/* 消费心理 */}
          <div className="px-4 py-3">
            <div className="flex items-baseline gap-1.5 mb-2.5">
              <div className="w-[3px] self-stretch rounded-sm flex-shrink-0" style={{ background: c.accent }} />
              <span className="text-[10px] font-bold flex-shrink-0" style={{ color: c.accent }}>消费心理</span>
              {seg.core_insight && (
                <span className="text-[12px] font-semibold text-gray-800 leading-snug">
                  ：{seg.core_insight}
                </span>
              )}
            </div>

            {hasSections ? (
              <div className="border border-gray-100 rounded-sm overflow-hidden">
                {seg.insight_sections!.map((section, i) => (
                  <div key={i} className={`flex ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                    <div
                      className="flex-shrink-0 px-2.5 py-2 text-[10px] font-semibold flex items-start justify-center text-center leading-snug pt-2"
                      style={{ width: 70, background: `${c.accent}0d`, color: c.accent }}
                    >
                      {section.title}
                    </div>
                    <div className="flex-1 px-3 py-2 text-[11px] text-gray-700 leading-snug">
                      {renderBold(section.text)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (seg.key_traits?.length ?? 0) > 0 ? (
              <ol className="space-y-1.5">
                {seg.key_traits!.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-sm text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: c.accent }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[11px] text-gray-700 leading-snug">{t}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          {/* 购车偏好 */}
          {hasBottom && (
            <div className="px-4 py-3" style={{ background: '#f9fafb' }}>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <div className="w-[3px] self-stretch rounded-sm flex-shrink-0" style={{ background: c.accent }} />
                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: c.accent }}>购车偏好</span>
                {seg.preference_intro && (
                  <span className="text-[12px] font-semibold text-gray-800 leading-snug">：{seg.preference_intro}</span>
                )}
              </div>
              {seg.preference_detail && (
                <p className="text-[10px] text-gray-600 leading-snug mb-2.5">
                  {renderBold(seg.preference_detail)}
                </p>
              )}
              {prefResolved.length > 0 && (
                <div
                  className="grid gap-x-6 gap-y-3"
                  style={{ gridTemplateColumns: `repeat(${Math.min(prefResolved.length, 3)}, 1fr)` }}
                >
                  {prefResolved.map(r => (
                    <div key={r.name}>
                      <div className="text-[9px] font-bold text-gray-400 tracking-wide mb-1">{r.name}</div>
                      <div className="space-y-1">
                        {r.entries.map(e => (
                          <DataBar key={e.value} value={e.value} pct={e.pct} bar={c.bar} dimColor wide />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Reference charts section ──────────────────────────────────

function ReferenceCharts({
  filteredRecords, chartable, aiDimNames,
}: {
  filteredRecords: Record<string, unknown>[];
  chartable:       Field[];
  aiDimNames:      string[]; // field names AI picked across all segments
}) {
  // Match AI-recommended dimension names to actual dataset fields
  const displayFields = aiDimNames.length > 0
    ? aiDimNames
        .map(name => chartable.find(f => f.name === name))
        .filter(Boolean) as Field[]
    : chartable.filter(f => CLUSTER_KW.some(kw => f.name.includes(kw)));

  const showFields = displayFields.slice(0, 4);
  if (showFields.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-5">
        人群分布参考（AI 推荐维度 · 当前筛选范围）
      </div>
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
        {showFields.map(f => {
          const dist = fieldDist(filteredRecords, f);
          if (!dist.length) return null;
          return (
            <div key={f.key}>
              <div className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">{f.name}</div>
              <div className="space-y-1.5">
                {dist.slice(0, 5).map(d => (
                  <MiniBar key={d.value} value={d.value} pct={d.pct} bar="#4a7fd4" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── GeoFilterInline ───────────────────────────────────────────

function GeoFilterInline({
  dataset, viewConfig, geoLevel, selected, onChange,
}: {
  dataset:    Dataset;
  viewConfig: ViewConfig;
  geoLevel:   GeoLevel;
  selected:   string[];
  onChange:   (v: string[]) => void;
}) {
  const options = useMemo(
    () => getGeoOptionsWithCount(dataset.records, viewConfig, geoLevel),
    [dataset, viewConfig, geoLevel],
  );
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');

  const levelLabel = geoLevel === 'region' ? '大区' : geoLevel === 'province' ? '省份' : '城市';
  const label =
    selected.length === 0 ? `选择${levelLabel}`
    : selected.length === 1 ? selected[0]
    : `${selected.length} 个${levelLabel}`;

  const filtered = search
    ? options.filter(o => o.value.includes(search))
    : options;

  function close() { setOpen(false); setSearch(''); }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border transition-all rounded-sm ${
          selected.length > 0
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
        }`}
      >
        <MapPin size={9} />
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute z-50 top-9 left-0 bg-white border border-gray-200 shadow-xl rounded-sm" style={{ width: 220 }}>
            {/* Search input */}
            <div className="p-1.5 border-b border-gray-100">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && close()}
                onClick={e => e.stopPropagation()}
                placeholder={`搜索${levelLabel}…`}
                className="w-full text-xs px-2 py-1 border border-gray-200 rounded-sm focus:outline-none focus:border-blue-300"
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              <button
                onClick={() => { onChange([]); close(); }}
                className="w-full text-left text-xs px-2 py-1.5 hover:bg-gray-50 text-gray-500 rounded-sm"
              >
                全部（不筛选）
              </button>
              {filtered.map(({ value, count }) => (
                <button
                  key={value}
                  onClick={() => onChange(selected.includes(value) ? selected.filter(s => s !== value) : [...selected, value])}
                  className={`w-full text-left text-xs px-2 py-1.5 hover:bg-gray-50 flex items-center gap-1.5 rounded-sm ${
                    selected.includes(value) ? 'text-blue-700 font-semibold' : 'text-gray-700'
                  }`}
                >
                  {selected.includes(value) && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                  <span className="flex-1 truncate">{value}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">n={count.toLocaleString()}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-xs text-gray-400 px-2 py-2 text-center">无结果</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── InsightView ───────────────────────────────────────────────

interface Props {
  dataset:    Dataset;
  viewConfig: ViewConfig;
}

export function InsightView({ dataset, viewConfig }: Props) {
  const { updateViewConfig } = useDatasetStore();
  const [geoLevel, setGeoLevel] = useUrlStringState<GeoLevel>(
    'filter_geo_level', 'all', ['all', 'region', 'province', 'city'],
  );
  const [selectedGeo, setSelectedGeo] = useUrlArrayState('filter_geo');
  const [selStatus, setSelStatus] = useUrlArrayState('filter_order', ['__all']);
  const [selMonths, setSelMonths] = useUrlArrayState('filter_time', ['__all']);
  const [clusterMethod, setClusterMethod] = useUrlStringState<ClusterMethod>(
    'insight_method', 'kmeans', ['kmeans', 'twostage'],
  );
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');

  const geoLevels = ([
    { key: 'region'   as GeoLevel, label: '大区',  fieldKey: viewConfig.geoRegionKey   },
    { key: 'province' as GeoLevel, label: '省份',  fieldKey: viewConfig.geoProvinceKey },
    { key: 'city'     as GeoLevel, label: '城市',  fieldKey: viewConfig.geoCityKey     },
  ] as const).filter(l => l.fieldKey);
  const timeField = useMemo(() => detectTimeField(dataset), [dataset]);
  const statusOptions = useMemo(() => getStatusOptions(dataset.records, viewConfig), [dataset.records, viewConfig]);
  const dateBlocks = useMemo(
    () => viewConfig.dateBlocks?.length ? viewConfig.dateBlocks : getDefaultDateBlocks(dataset, timeField),
    [dataset, timeField, viewConfig.dateBlocks],
  );
  const monthOptions = useMemo(() => dateBlocks.map(block => block.key), [dateBlocks]);
  const monthLabels = useMemo(() => Object.fromEntries(dateBlocks.map(block => [block.key, block.label])), [dateBlocks]);

  const cacheKey = useMemo(
    () => `${geoLevel}_${selectedGeo.join(',')}_s${selStatus.join(',')}_t${selMonths.join(',')}_r${dataset.rowCount}_m${clusterMethod}`,
    [geoLevel, selectedGeo, selStatus, selMonths, dataset.rowCount, clusterMethod],
  );

  const cachedResult: ClusterInsightResult | undefined = viewConfig.clusterResults?.[cacheKey];

  const filteredRecords = useMemo(
    () => filterByDateBlocks(
      filterRecords(dataset.records, viewConfig, geoLevel, selectedGeo, selStatus),
      timeField,
      selMonths,
      dateBlocks,
    ),
    [dataset.records, viewConfig, geoLevel, selectedGeo, selStatus, timeField, selMonths, dateBlocks],
  );

  const { chartable, clusterFields, supplementFields } = useMemo(
    () => categorise(dataset, viewConfig),
    [dataset, viewConfig],
  );

  const contextLabel = useMemo(() => {
    const geo = selectedGeo.length > 0 ? selectedGeo.join(' / ') : '全国';
    const order = selStatus.includes('__all') ? '' : ` · ${selStatus.join('/')}`;
    const time = selMonths.includes('__all') ? '' : ` · ${selMonths.map(key => monthLabels[key] ?? key).join('/')}`;
    return `${geo}${order}${time}`;
  }, [selectedGeo, selStatus, selMonths, monthLabels]);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      // Run statistical clustering in-browser (deterministic, seeded PRNG)
      const clusterResult = computeClusters(
        filteredRecords,
        clusterFields,
        supplementFields.slice(0, 6),
        2, 5,
        clusterMethod,
      );

      let body: Record<string, unknown>;
      if (clusterResult) {
        body = {
          datasetName:  dataset.name,
          label:        contextLabel,
          totalCount:   filteredRecords.length,
          optimalK:     clusterResult.optimalK,
          clusters:     clusterResult.clusters,
          fieldOptions: clusterResult.fieldOptions,
          clusterMethod,
        };
      } else {
        // Fallback: distribution-based (insufficient data or missing cluster fields)
        if (clusterFields.length === 0) {
          setError('未找到年龄/学历/职业等聚类字段，请检查数据集字段名称');
          setLoading(false);
          return;
        }
        const mkDist = (fields: Field[]) =>
          fields.map(f => ({
            name:         f.name,
            distribution: fieldDist(filteredRecords, f),
          }));
        body = {
          datasetName:      dataset.name,
          label:            contextLabel,
          totalCount:       filteredRecords.length,
          clusterFields:    mkDist(clusterFields),
          supplementFields: mkDist(supplementFields.slice(0, 6)),
        };
      }

      const res = await fetch('/api/ai/cluster-insight', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { result?: ClusterInsightResult; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.result) {
        updateViewConfig(dataset.id, {
          clusterResults: { ...(viewConfig.clusterResults ?? {}), [cacheKey]: data.result },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '聚类分析失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Filter + action bar ── */}
      <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4 space-y-3">

        <div className="flex items-center gap-3 flex-wrap">

        {/* Geo level selector */}
        <GeoFilterGroup
          dataset={dataset}
          viewConfig={viewConfig}
          level={geoLevel}
          selected={selectedGeo}
          onLevelChange={setGeoLevel}
          onChange={setSelectedGeo}
        />

        <div className="h-4 w-px bg-gray-200 mx-1" />

        <span className="text-xs text-gray-400">
          {contextLabel} · <span className="font-semibold text-gray-600">{filteredRecords.length.toLocaleString()}</span> 份样本
        </span>

        <div className="flex-1" />

        <label className="sr-only" htmlFor="cluster-method">聚类算法</label>
        <select
          id="cluster-method"
          value={clusterMethod}
          onChange={event => setClusterMethod(event.target.value as ClusterMethod)}
          title={CLUSTER_METHODS.find(method => method.value === clusterMethod)?.desc}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:border-indigo-300"
        >
          {CLUSTER_METHODS.map(method => (
            <option key={method.value} value={method.value}>{method.label}</option>
          ))}
        </select>

        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 text-xs px-5 py-2 font-semibold tracking-wide text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all rounded-sm"
          style={{ background: '#003087' }}
        >
          {loading
            ? <><Loader2 size={11} className="animate-spin" />分析中…</>
            : <><RefreshCw size={11} />{cachedResult ? '重新分析' : '开始聚类分析'}</>
          }
        </button>
        </div>

        <StatusFilterGroups
          orderLabel={viewConfig.statusVariableName?.trim() || '订单状态'}
          orderOptions={statusOptions}
          selectedOrders={selStatus}
          onOrdersChange={setSelStatus}
          monthOptions={monthOptions}
          selectedMonths={selMonths}
          onMonthsChange={setSelMonths}
          monthLabels={monthLabels}
        />
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white p-14 text-gray-500">
          <Loader2 size={22} className="animate-spin" style={{ color: '#003087' }} />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">正在分析人群特征</p>
            <p className="text-xs text-gray-400 mt-1">
              已完成统计聚类{clusterMethod === 'twostage' ? '（两阶段职业锚定）' : '（Calinski-Harabasz 指数）'}，AI 正在撰写群体洞察，通常需要 {clusterMethod === 'twostage' ? '30-60' : '20-40'} 秒
            </p>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && cachedResult && (
        <div className="space-y-3">

          {/* Overview banner */}
          {cachedResult.overview && (
            <div className="rounded-sm border border-[#003087]/20 overflow-hidden">
              <div className="px-4 py-2 flex items-center gap-2" style={{ background: '#003087' }}>
                <div className="w-[3px] h-3.5 rounded-sm flex-shrink-0 bg-blue-300/60" />
                <span className="text-blue-200 text-[10px] font-bold tracking-widest">OVERVIEW</span>
              </div>
              <div className="px-5 py-4" style={{ background: '#edf2fb' }}>
                <MarkdownContent content={cachedResult.overview} className="text-[#1e3a5f]" />
              </div>
            </div>
          )}

          {/* Segment cards */}
          {cachedResult.segments.map((seg, i) => (
            <SegmentCard
              key={i}
              seg={seg}
              index={i}
              chartable={chartable}
              clusterFields={clusterFields}
              filteredRecords={filteredRecords}
            />
          ))}

          {/* Reference charts — cluster fields not already in who_data */}
          {(() => {
            const shownNames = new Set([
              ...cachedResult.segments.flatMap(s => (s.who_data ?? []).map(d => d.field)),
              ...cachedResult.segments.flatMap(s => (s.preference_data ?? []).map(d => d.field)),
              ...cachedResult.segments.flatMap(s => s.preference_fields ?? []),
            ]);
            const aiDimNames = [...new Set(
              cachedResult.segments.flatMap(s => Object.keys(s.dimensions ?? {}))
            )].filter(n => !shownNames.has(n)).slice(0, 4);
            return aiDimNames.length > 0
              ? <ReferenceCharts filteredRecords={filteredRecords} chartable={chartable} aiDimNames={aiDimNames} />
              : null;
          })()}

          {/* Footer */}
          <div className="text-[10px] text-gray-300 text-right pr-1">
            聚类分析生成于 {new Date(cachedResult.generatedAt).toLocaleString('zh-CN')}
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !cachedResult && !error && (
        <div className="bg-white border border-gray-200 rounded-sm p-14 flex flex-col items-center gap-4 text-gray-400">
          <div
            className="w-12 h-12 rounded-sm flex items-center justify-center"
            style={{ background: '#edf2fb' }}
          >
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#003087" strokeWidth={1.8}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">人群聚类分析</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
              选择地区范围后，点击「开始聚类分析」，AI 将基于年龄、学历、职业、工作生活状态对人群进行自动细分
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
