'use client';

import { useState, useMemo } from 'react';
import { Loader2, RefreshCw, MapPin } from 'lucide-react';
import { filterRecords, getGeoOptions, type GeoLevel } from '@/lib/filterRecords';
import { aggregateField } from '@/lib/dataAggregator';
import { useDatasetStore } from '@/store/datasetStore';
import type { ViewConfig, ClusterInsightResult, ClusterSegment } from '@/lib/viewConfig';
import type { Dataset, Field } from '@/types/dataSchema';

// ── McKinsey palette (one per segment) ───────────────────────

const MK_COLORS = [
  { accent: '#003087', bg: '#edf2fb', bar: '#4a7fd4' },
  { accent: '#00533a', bg: '#edf7f2', bar: '#3da874' },
  { accent: '#6b1d3e', bg: '#faeef4', bar: '#c0507a' },
  { accent: '#4a3000', bg: '#faf5e8', bar: '#c4922a' },
] as const;

// ── Field categorisation ──────────────────────────────────────

const CLUSTER_KW      = ['年龄', '学历', '行业', '职业', '岗位', '工作状态', '工作生活', '生活状态', '收入'];
const DISPLAY_EXCL_KW = ['大区', '省份', '城市', '地区', '状态', '意向', '订单', '阶段',
                          '号码', '姓名', '电话', '联系', '编号', 'ID', 'id'];

function categorise(dataset: Dataset, vc: ViewConfig) {
  const excluded = new Set(
    [vc.geoRegionKey, vc.geoProvinceKey, vc.geoCityKey, vc.statusFieldKey].filter(Boolean) as string[],
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

// ── MiniBar ───────────────────────────────────────────────────

function MiniBar({ value, pct, bar }: { value: string; pct: number; bar: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-[11px] text-gray-600 w-16 truncate flex-shrink-0">{value}</div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: bar }} />
      </div>
      <div className="text-[11px] text-gray-500 w-7 text-right flex-shrink-0">{pct.toFixed(0)}%</div>
    </div>
  );
}

// ── Segment card ──────────────────────────────────────────────

function SegmentCard({
  seg, index, chartable, filteredRecords,
}: {
  seg:             ClusterSegment;
  index:           number;
  chartable:       Field[];
  filteredRecords: Record<string, unknown>[];
}) {
  const c = MK_COLORS[index % MK_COLORS.length];

  // Show AI estimated dimension distribution (dimensions object from AI)
  const dimEntries = seg.dimensions
    ? Object.entries(seg.dimensions).filter(([, v]) => v.top_value && v.est_pct > 0)
    : [];

  // Fallback: show overall distribution for cluster fields if AI didn't return dimensions
  const showOverallBars = dimEntries.length === 0;
  const overallBars = showOverallBars
    ? chartable
        .filter(f => CLUSTER_KW.some(kw => f.name.includes(kw)))
        .slice(0, 4)
        .map(f => {
          const dist = fieldDist(filteredRecords, f);
          const top  = dist[0];
          return top ? { name: f.name, value: top.value, pct: top.pct } : null;
        })
        .filter(Boolean) as { name: string; value: string; pct: number }[]
    : [];

  return (
    <div
      className="bg-white border border-gray-200 rounded-sm overflow-hidden"
      style={{ borderLeft: `4px solid ${c.accent}` }}
    >
      {/* ── Header ── */}
      <div className="px-5 py-4 flex items-center gap-4 border-b border-gray-100" style={{ background: c.bg }}>
        <span
          className="text-[10px] font-bold tracking-[0.2em] px-2 py-0.5 rounded-sm flex-shrink-0"
          style={{ background: `${c.accent}18`, color: c.accent }}
        >
          SEGMENT {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <div className="text-[20px] font-bold text-gray-900 leading-tight">{seg.name}</div>
          <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{seg.subtitle}</div>
        </div>
      </div>

      {/* ── Body — 3 cols ── */}
      <div className="grid grid-cols-[180px_1fr_1fr] divide-x divide-gray-100">

        {/* Col 1 — 人群画像 */}
        <div className="px-5 py-4">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-4">人群画像</div>
          {dimEntries.length > 0 ? (
            <div className="space-y-3">
              {dimEntries.map(([field, dim]) => (
                <div key={field}>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{field}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(dim.est_pct, 100)}%`, background: c.bar }} />
                    </div>
                    <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: c.accent }}>
                      {dim.est_pct}%
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-gray-700 mt-0.5">{dim.top_value}</div>
                </div>
              ))}
            </div>
          ) : overallBars.length > 0 ? (
            <div className="space-y-3">
              {overallBars.map(b => (
                <div key={b.name}>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{b.name}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(b.pct, 100)}%`, background: c.bar }} />
                    </div>
                    <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: c.accent }}>
                      {b.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-gray-700 mt-0.5">{b.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-300">暂无画像数据</p>
          )}
        </div>

        {/* Col 2 — 关键特征 */}
        <div className="px-5 py-4">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-4">关键特征</div>
          <ol className="space-y-2.5">
            {(seg.key_traits ?? []).map((t, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="w-4 h-4 rounded-sm text-[9px] font-bold text-white flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: c.accent }}
                >
                  {i + 1}
                </span>
                <span className="text-[12px] text-gray-700 leading-snug">{t}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Col 3 — 核心洞察 + 购车动机 */}
        <div className="px-5 py-4">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-4">核心洞察</div>
          <p className="text-[12px] text-gray-700 leading-relaxed">{seg.core_insight}</p>
          {seg.purchase_motivation && (
            <>
              <div className="h-px bg-gray-100 my-4" />
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-2">购车动机</div>
              <p className="text-[12px] text-gray-600 leading-relaxed">{seg.purchase_motivation}</p>
            </>
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
    <div className="bg-white border border-gray-200 rounded-sm p-6">
      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-5">
        人群分布参考（AI 推荐维度 · 当前筛选范围）
      </div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-6">
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
    () => getGeoOptions(dataset.records, viewConfig, geoLevel),
    [dataset, viewConfig, geoLevel],
  );
  const [open, setOpen] = useState(false);
  const levelLabel = geoLevel === 'region' ? '大区' : geoLevel === 'province' ? '省份' : '城市';
  const label =
    selected.length === 0 ? `选择${levelLabel}`
    : selected.length === 1 ? selected[0]
    : `${selected.length} 个${levelLabel}`;

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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-9 left-0 bg-white border border-gray-200 shadow-xl p-2 w-40 max-h-56 overflow-y-auto rounded-sm">
            <button
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full text-left text-xs px-2 py-1.5 hover:bg-gray-50 text-gray-500"
            >
              全部（不筛选）
            </button>
            {options.map(v => (
              <button
                key={v}
                onClick={() => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])}
                className={`w-full text-left text-xs px-2 py-1.5 hover:bg-gray-50 flex items-center gap-1.5 ${
                  selected.includes(v) ? 'text-blue-700 font-semibold' : 'text-gray-700'
                }`}
              >
                {selected.includes(v) && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                {v}
              </button>
            ))}
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

  const [geoLevel,    setGeoLevel]    = useState<GeoLevel>('region');
  const [selectedGeo, setSelectedGeo] = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const geoLevels = ([
    { key: 'region'   as GeoLevel, label: '大区',  fieldKey: viewConfig.geoRegionKey   },
    { key: 'province' as GeoLevel, label: '省份',  fieldKey: viewConfig.geoProvinceKey },
    { key: 'city'     as GeoLevel, label: '城市',  fieldKey: viewConfig.geoCityKey     },
  ] as const).filter(l => l.fieldKey);

  const cacheKey = useMemo(
    () => `${geoLevel}_${selectedGeo.join(',')}`,
    [geoLevel, selectedGeo],
  );

  const cachedResult: ClusterInsightResult | undefined = viewConfig.clusterResults?.[cacheKey];

  const filteredRecords = useMemo(
    () => filterRecords(dataset.records, viewConfig, geoLevel, selectedGeo, ['__all']),
    [dataset, viewConfig, geoLevel, selectedGeo],
  );

  const { chartable, clusterFields, supplementFields } = useMemo(
    () => categorise(dataset, viewConfig),
    [dataset, viewConfig],
  );

  const contextLabel = useMemo(() => {
    const geo = selectedGeo.length > 0 ? selectedGeo.join(' / ') : '全国';
    return `${geo}`;
  }, [selectedGeo]);

  async function generate() {
    if (clusterFields.length === 0) {
      setError('未找到年龄/学历/职业等聚类字段，请检查数据集字段名称');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const mkDist = (fields: Field[]) =>
        fields.map(f => ({
          name:         f.name,
          distribution: fieldDist(filteredRecords, f),
        }));

      const res = await fetch('/api/ai/cluster-insight', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName:      dataset.name,
          label:            contextLabel,
          totalCount:       filteredRecords.length,
          clusterFields:    mkDist(clusterFields),
          supplementFields: mkDist(supplementFields.slice(0, 6)),
        }),
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
      <div className="bg-white border border-gray-200 rounded-sm px-5 py-3.5 flex items-center gap-3 flex-wrap">

        {/* Geo level selector */}
        <div className="flex items-center gap-1">
          {geoLevels.map(l => (
            <button
              key={l.key}
              onClick={() => { setGeoLevel(l.key); setSelectedGeo([]); }}
              className={`text-xs px-2.5 py-1 font-medium transition-all rounded-sm ${
                geoLevel === l.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <GeoFilterInline
          dataset={dataset}
          viewConfig={viewConfig}
          geoLevel={geoLevel}
          selected={selectedGeo}
          onChange={setSelectedGeo}
        />

        <div className="h-4 w-px bg-gray-200 mx-1" />

        <span className="text-xs text-gray-400">
          {contextLabel} · <span className="font-semibold text-gray-600">{filteredRecords.length.toLocaleString()}</span> 份样本
        </span>

        <div className="flex-1" />

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

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-4 py-3">{error}</div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white border border-gray-200 rounded-sm p-14 flex flex-col items-center gap-4 text-gray-400">
          <Loader2 size={22} className="animate-spin" style={{ color: '#003087' }} />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">AI 正在对人群进行聚类分析</p>
            <p className="text-xs text-gray-400 mt-1">基于年龄、学历、职业、工作生活状态进行细分，通常需要 20-40 秒</p>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && cachedResult && (
        <div className="space-y-3">

          {/* Overview banner */}
          {cachedResult.overview && (
            <div
              className="px-5 py-3 rounded-sm border text-sm font-medium text-white"
              style={{ background: '#003087', borderColor: '#003087' }}
            >
              <span className="text-blue-200 text-[10px] font-bold tracking-widest mr-3">OVERVIEW</span>
              {cachedResult.overview}
            </div>
          )}

          {/* Segment cards */}
          {cachedResult.segments.map((seg, i) => (
            <SegmentCard
              key={i}
              seg={seg}
              index={i}
              chartable={chartable}
              filteredRecords={filteredRecords}
            />
          ))}

          {/* Reference charts — 4 AI-recommended dimensions */}
          {(() => {
            const aiDimNames = [...new Set(
              cachedResult.segments.flatMap(s => Object.keys(s.dimensions ?? {}))
            )].slice(0, 4);
            return <ReferenceCharts filteredRecords={filteredRecords} chartable={chartable} aiDimNames={aiDimNames} />;
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
