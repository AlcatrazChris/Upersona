'use client';

import { useState, useMemo, useRef } from 'react';
import { Plus, X, ChevronDown, BarChart2, Layers } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer,
} from 'recharts';
import {
  aggregateField,
  aggregateByStatusGroups,
  aggregateCrossDatasetByStatus,
} from '@/lib/dataAggregator';
import { filterRecords }            from '@/lib/filterRecords';
import { ChartRenderer }            from '@/components/charts/engine/ChartRenderer';
import { GroupedBarChartEngine }    from '@/components/charts/engine/GroupedBarChartEngine';
import { ChartSettingsPanel }       from '@/components/charts/ChartSettingsPanel';
import { AIInsightPanel }           from '@/components/shared/AIInsightPanel';
import { DEFAULT_CHART_CONFIG, loadChartConfig, saveChartConfig, getColors, type ChartConfig } from '@/lib/chartConfig';
import { useDatasetStore }          from '@/store/datasetStore';
import { useIsAdmin }               from '@/lib/auth';
import { StatusGroupEditor }        from './StatusGroupEditor';
import { cn } from '@/lib/utils';
import type { Dataset, Field } from '@/types/dataSchema';
import type { ViewConfig, StatusGroup } from '@/lib/viewConfig';
import type { ChartType } from '@/components/charts/engine/ChartRenderer';

// ── Intent styling ─────────────────────────────────────────────

const INTENT_ACTIVE: Record<StatusGroup['intent'], string> = {
  strong:  'bg-emerald-500 text-white border-emerald-500',
  neutral: 'bg-blue-500   text-white border-blue-500',
  weak:    'bg-red-400    text-white border-red-400',
};
const INTENT_GHOST: Record<StatusGroup['intent'], string> = {
  strong:  'bg-emerald-50  text-emerald-700 border-emerald-200',
  neutral: 'bg-blue-50     text-blue-700    border-blue-200',
  weak:    'bg-red-50      text-red-600     border-red-200',
};
const INTENT_DOT: Record<StatusGroup['intent'], string> = {
  strong:  'bg-emerald-500',
  neutral: 'bg-blue-500',
  weak:    'bg-red-400',
};
const INTENT_HEX_PRIMARY: Record<StatusGroup['intent'], string> = {
  strong:  '#10b981',
  neutral: '#3b82f6',
  weak:    '#f87171',
};
const INTENT_HEX_COMPARE: Record<StatusGroup['intent'], string> = {
  strong:  '#6ee7b7',
  neutral: '#93c5fd',
  weak:    '#fca5a5',
};

// ── Dataset picker ─────────────────────────────────────────────

function DatasetPicker({
  datasets, currentId, selectedId, onSelect,
}: {
  datasets:   Dataset[];
  currentId:  string;
  selectedId: string | null;
  onSelect:   (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const options  = datasets.filter(d => d.id !== currentId);
  const selected = options.find(d => d.id === selectedId);

  if (selectedId && selected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs bg-violet-50 text-violet-700 border border-violet-200 pl-2.5 pr-1.5 py-1 rounded-xl">
        {selected.name}
        <button onClick={() => onSelect(null)} className="hover:text-violet-900" title="移除对比">
          <X size={11} />
        </button>
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={options.length === 0}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-dashed border-violet-300 text-violet-500 hover:bg-violet-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={10} />
        添加对比数据集
        <ChevronDown size={9} />
      </button>
      {open && options.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-9 left-0 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[200px] max-h-60 overflow-y-auto">
            {options.map(d => (
              <button
                key={d.id}
                onClick={() => { onSelect(d.id); setOpen(false); }}
                className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 text-gray-700"
              >
                <div className="font-medium truncate">{d.name}</div>
                <div className="text-gray-400 mt-0.5">{d.rowCount.toLocaleString()} 行 · {d.fields.length} 字段</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── StatusChartCard ────────────────────────────────────────────

interface StatusChartCardProps {
  field:          Field;
  dataset:        Dataset;
  statusFieldKey: string;
  selectedGroups: StatusGroup[];
  config:         ChartConfig;
  compareDataset?: Dataset;
}

function StatusChartCard({
  field, dataset, statusFieldKey, selectedGroups, config, compareDataset,
}: StatusChartCardProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  // manualH: 用户拖拽覆盖；null 时跟随全局 config.chartHeight
  const [manualH,   setManualH]   = useState<number | null>(null);
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null);

  const isCross  = !!compareDataset;
  const isSingle = selectedGroups.length === 1 && !isCross;

  // ── Aggregations ──
  const singleData = useMemo(() => {
    if (!isSingle) return null;
    const group    = selectedGroups[0];
    const filtered = dataset.records.filter(r =>
      group.values.includes(String(r[statusFieldKey] ?? '')),
    );
    return { items: aggregateField(filtered, field), n: filtered.length };
  }, [isSingle, dataset.records, field, statusFieldKey, selectedGroups]);

  const crossData = useMemo(() => {
    if (!isCross || !compareDataset) return null;
    return aggregateCrossDatasetByStatus(
      { records: dataset.records,        label: dataset.name },
      { records: compareDataset.records, label: compareDataset.name },
      field, statusFieldKey, selectedGroups,
    );
  }, [isCross, dataset, compareDataset, field, statusFieldKey, selectedGroups]);

  const multiData = useMemo(() => {
    if (isSingle || isCross) return null;
    return aggregateByStatusGroups(dataset.records, field, statusFieldKey, selectedGroups);
  }, [isSingle, isCross, dataset.records, field, statusFieldKey, selectedGroups]);

  // ── Height ──
  // Use global config.chartHeight; if that's too small for the data, expand automatically
  const rowCount  = isSingle ? (singleData?.items.length ?? 0)
                 : isCross  ? (crossData?.items.length  ?? 0)
                 :             (multiData?.items.length  ?? 0);
  const seriesCnt = isSingle ? 1 : isCross ? selectedGroups.length * 2 : selectedGroups.length;
  const dataH     = Math.max(240, Math.min(rowCount * (seriesCnt * 26 + 10) + 80, 700));
  const chartH    = manualH ?? Math.max(config.chartHeight, dataH);

  // ── Colors ──
  // 使用配色方案颜色，同时保留 intent 点状指示（语义化）
  const schemeColors  = getColors(config.colorScheme);
  const crossColors   = selectedGroups.flatMap((_, i) => [
    schemeColors[i * 2 % schemeColors.length],
    schemeColors[(i * 2 + 1) % schemeColors.length],
  ]);
  const multiColors   = selectedGroups.map((_, i) => schemeColors[i % schemeColors.length]);

  // ── Resize ──
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startH: chartH };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setManualH(Math.max(160, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY)));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Subtitle ──
  const subtitle = isSingle ? (
    <span className="flex items-center gap-1.5">
      <span className={cn('w-1.5 h-1.5 rounded-full', INTENT_DOT[selectedGroups[0].intent])} />
      {selectedGroups[0].label}
      <span className="text-gray-300">·</span>
      有效样本 n={(singleData?.n ?? 0).toLocaleString()}
    </span>
  ) : isCross ? (
    <span className="flex items-center gap-2 flex-wrap">
      <span className="text-violet-500 font-medium">{dataset.name}</span>
      <span className="text-gray-300">vs</span>
      <span className="text-violet-500 font-medium">{compareDataset!.name}</span>
      {selectedGroups.map(g => (
        <span key={g.key} className="flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full', INTENT_DOT[g.intent])} />
          {g.label}
        </span>
      ))}
    </span>
  ) : (
    <span className="flex items-center gap-2 flex-wrap">
      {selectedGroups.map(g => (
        <span key={g.key} className="flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full', INTENT_DOT[g.intent])} />
          {g.label}
          <span className="text-gray-300">
            n={(multiData?.groupTotals[g.label] ?? 0).toLocaleString()}
          </span>
        </span>
      ))}
    </span>
  );

  const singleCfg = { ...config, showSampleCount: false, chartHeight: chartH };
  const multiCfg  = { ...config, showSampleCount: true,  chartHeight: chartH };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 relative group select-none">

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-800">{field.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Chart type toggle (single-group only) — visible on hover */}
        {isSingle && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {(['bar', 'pie', 'donut'] as ChartType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-md transition-all',
                    chartType === t
                      ? 'bg-white text-gray-800 shadow-sm font-medium'
                      : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  {t === 'bar' ? '条' : t === 'pie' ? '饼' : '环'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {isSingle && singleData ? (
        <ChartRenderer
          type={chartType}
          data={singleData.items.slice(0, 10)}
          config={singleCfg}
          isMultiSelect={field.type === 'multi_choice'}
          totalSamples={singleData.n}
          height={chartH}
        />
      ) : isCross && crossData ? (
        <GroupedBarChartEngine
          data={crossData}
          mode="grouped"
          config={multiCfg}
          height={chartH}
          seriesColors={crossColors}
        />
      ) : multiData ? (
        <GroupedBarChartEngine
          data={multiData}
          mode="grouped"
          config={multiCfg}
          height={chartH}
          seriesColors={multiColors}
        />
      ) : null}

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-16 h-4 flex items-center justify-center cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
        title="拖动调整高度"
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full hover:bg-blue-300 transition-colors" />
      </div>
    </div>
  );
}

// ── ProportionStackedCard ──────────────────────────────────────
// Horizontal 100% stacked bar: Y = status groups, segments = field value proportions

function ProportionStackedCard({
  field,
  dataset,
  statusFieldKey,
  selectedGroups,
  config,
}: {
  field:          Field;
  dataset:        Dataset;
  statusFieldKey: string;
  selectedGroups: StatusGroup[];
  config:         ChartConfig;
}) {
  const schemeColors = getColors(config.colorScheme);

  // Collect all unique field values across selected groups
  const allValues = useMemo(() => {
    const set = new Set<string>();
    for (const group of selectedGroups) {
      const recs = dataset.records.filter(r =>
        group.values.includes(String(r[statusFieldKey] ?? '')),
      );
      for (const rec of recs) {
        const raw = String(rec[field.key] ?? '');
        const vals = field.type === 'multi_choice'
          ? raw.split(field.multiDelimiter ?? '|')
          : [raw];
        for (const v of vals) {
          const t = v.trim();
          if (t) set.add(t);
        }
      }
    }
    // Sort by frequency in first group descending
    return [...set].sort((a, b) => {
      const g0 = selectedGroups[0];
      const recs = dataset.records.filter(r =>
        g0.values.includes(String(r[statusFieldKey] ?? '')),
      );
      const freq = (v: string) => recs.filter(r => {
        const raw = String(r[field.key] ?? '');
        const vals = field.type === 'multi_choice'
          ? raw.split(field.multiDelimiter ?? '|')
          : [raw];
        return vals.map(x => x.trim()).includes(v);
      }).length;
      return freq(b) - freq(a);
    }).slice(0, 12);
  }, [dataset.records, field, statusFieldKey, selectedGroups]);

  // Build bar data: one row per status group
  const barData = useMemo(() =>
    selectedGroups.map(group => {
      const recs = dataset.records.filter(r =>
        group.values.includes(String(r[statusFieldKey] ?? '')),
      );
      const total = recs.length || 1;
      const row: Record<string, string | number> = { group: group.label, n: recs.length };
      for (const val of allValues) {
        const cnt = recs.filter(r => {
          const raw = String(r[field.key] ?? '');
          const vals = field.type === 'multi_choice'
            ? raw.split(field.multiDelimiter ?? '|')
            : [raw];
          return vals.map(x => x.trim()).includes(val);
        }).length;
        row[val] = parseFloat(((cnt / total) * 100).toFixed(1));
      }
      return row;
    }),
  [dataset.records, field, statusFieldKey, selectedGroups, allValues]);

  const chartH = Math.max(160, selectedGroups.length * 48 + 80);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { name: string; value: number; color: string }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs max-w-[200px]">
        <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
        {payload.filter(p => p.value > 0).map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 leading-tight py-0.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-600 truncate">{p.name}</span>
            <span className="text-gray-400 ml-auto pl-2 tabular-nums">{p.value}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 col-span-2">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{field.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">各状态群体占比分布</p>
      </div>
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart layout="vertical" data={barData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="group"
            type="category"
            tick={{ fontSize: 12, fill: '#374151' }}
            width={80}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) =>
              value.length > 10 ? value.slice(0, 9) + '…' : value
            }
          />
          {allValues.map((val, i) => (
            <Bar
              key={val}
              dataKey={val}
              stackId="a"
              fill={schemeColors[i % schemeColors.length]}
              radius={i === 0 ? [4, 0, 0, 4] : i === allValues.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── StatusView ─────────────────────────────────────────────────

interface Props {
  dataset:    Dataset;
  viewConfig: ViewConfig;
}

export function StatusView({ dataset, viewConfig }: Props) {
  const { updateViewConfig, datasets: allDatasets, personaConfigs, activePersonaConfigId } = useDatasetStore();
  const isAdmin  = useIsAdmin();
  const groups   = viewConfig.statusGroups ?? [];

  const configs      = personaConfigs[dataset.id] ?? [];
  const activeConfig = configs.find(c => c.id === activePersonaConfigId);

  // Derive the initial field keys respecting persona config order
  const initFieldKeys = (() => {
    if (activeConfig) {
      return activeConfig.blocks
        .filter(b => b.visible && b.sourceFieldKey)
        .map(b => b.sourceFieldKey!)
        .slice(0, 6);
    }
    return (viewConfig.personaFieldKeys ?? []).slice(0, 6);
  })();

  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>(groups.map(g => g.key));
  const [selectedDimKeys,   setSelectedDimKeys]   = useState<string[]>(initFieldKeys);
  const [compareDatasetId,  setCompareDatasetId]  = useState<string | null>(null);
  const [editorOpen,        setEditorOpen]        = useState(false);
  const [chartMode,         setChartMode]         = useState<'dimension' | 'proportion'>('dimension');
  const [globalConfig,      setGlobalConfig]      = useState<ChartConfig>(
    () => ({ ...DEFAULT_CHART_CONFIG, ...loadChartConfig('status') }),
  );

  const handleConfigChange = (c: ChartConfig) => {
    setGlobalConfig(c);
    saveChartConfig('status', c);
  };

  const statusField     = dataset.fields.find(f => f.key === viewConfig.statusFieldKey);
  const allStatusValues = statusField?.options ?? [];
  const selectedGroups  = groups.filter(g => selectedGroupKeys.includes(g.key));

  const compareDataset = useMemo(
    () => compareDatasetId ? allDatasets.find(d => d.id === compareDatasetId) : undefined,
    [compareDatasetId, allDatasets],
  );

  const commonFieldKeys = useMemo(() => {
    if (!compareDataset) return null;
    const cKeys = new Set(compareDataset.fields.map(f => f.key));
    return new Set((viewConfig.personaFieldKeys ?? []).filter(k => cKeys.has(k)));
  }, [compareDataset, viewConfig.personaFieldKeys]);

  const allPersonaFields = useMemo(() => {
    if (activeConfig) {
      return activeConfig.blocks
        .filter(b => b.visible && b.sourceFieldKey)
        .map(b => dataset.fields.find(f => f.key === b.sourceFieldKey))
        .filter(Boolean) as Field[];
    }
    return (viewConfig.personaFieldKeys ?? [])
      .map(k => dataset.fields.find(f => f.key === k))
      .filter(Boolean) as Field[];
  }, [dataset.fields, viewConfig.personaFieldKeys, activeConfig]);

  const personaFields = useMemo(
    () => selectedDimKeys
      .filter(k => !commonFieldKeys || commonFieldKeys.has(k))
      .map(k => dataset.fields.find(f => f.key === k))
      .filter(Boolean) as Field[],
    [dataset.fields, selectedDimKeys, commonFieldKeys],
  );

  const filteredRecords = useMemo(() => {
    const vals = selectedGroups.flatMap(g => g.values);
    return filterRecords(dataset.records, viewConfig, 'all', [], vals);
  }, [dataset.records, viewConfig, selectedGroups]);

  const toggleGroup = (key: string) =>
    setSelectedGroupKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );

  const toggleDim = (key: string) =>
    setSelectedDimKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );

  const handleSaveGroups = (newGroups: StatusGroup[]) =>
    updateViewConfig(dataset.id, { statusGroups: newGroups });

  // ── AI Insight helpers ─────────────────────────────
  const insightCacheKey = `status_${selectedGroupKeys.join(',')}_${selectedDimKeys.join(',')}_${compareDatasetId ?? ''}`;
  const insightLabel = selectedGroups.length === 0
    ? '（请先选择状态组）'
    : `${selectedGroups.map(g => g.label).join(' vs ')} · ${personaFields.map(f => f.name).join('、').slice(0, 30)}`;

  const STATUS_DEFAULT_PROMPT = `分析上方数据，找出驱动购车转化的决定性因素。禁止开场白、总结段落、套话。

## 转化信号（≤3条）
格式：[维度]——强意向【XX%】vs弱意向【XX%】，差距XX%→[判断]

## 流失画像与建议（≤2条）
格式：[流失特征]——[具体行动建议]

只引用上方真实数据，每条≤40字，不输出其他任何内容。`;

  function buildStatusContext() {
    return {
      analysisType:  'status_comparison',
      dataset:       dataset.name,
      statusGroups:  selectedGroups.map(g => ({ label: g.label, intent: g.intent })),
      dimensions:    personaFields.map(f => f.name),
      totalSamples:  filteredRecords.length,
      note:          compareDataset ? `与对比数据集「${compareDataset.name}」（${compareDataset.rowCount} 行）进行跨数据集对比` : undefined,
    };
  }

  if (!statusField || groups.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
        请先在数据中心配置订单状态字段，此视图将自动生成状态对比图表
      </div>
    );
  }

  const commonCount = commonFieldKeys?.size ?? 0;

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">

        {/* Row 1: Status group pills + chart settings */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 flex-shrink-0">对比状态</span>

          {groups.map(g => {
            const active = selectedGroupKeys.includes(g.key);
            return (
              <button
                key={g.key}
                onClick={() => toggleGroup(g.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
                  active ? INTENT_ACTIVE[g.intent] : INTENT_GHOST[g.intent],
                )}
              >
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  active ? 'bg-white' : `${INTENT_DOT[g.intent]} opacity-60`,
                )} />
                {g.label}
                {g.values.length > 1 && (
                  <span className={cn('text-[10px]', active ? 'text-white/70' : 'opacity-50')}>
                    {g.values.length} 项
                  </span>
                )}
              </button>
            );
          })}

          <span className="text-xs text-gray-400">
            {filteredRecords.length.toLocaleString()} 个样本
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-0.5">
              <button
                onClick={() => setChartMode('dimension')}
                className={cn(
                  'flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all',
                  chartMode === 'dimension'
                    ? 'bg-white text-gray-800 shadow-sm font-medium'
                    : 'text-gray-400 hover:text-gray-600',
                )}
              >
                <BarChart2 size={11} />
                维度分布
              </button>
              <button
                onClick={() => setChartMode('proportion')}
                className={cn(
                  'flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all',
                  chartMode === 'proportion'
                    ? 'bg-white text-gray-800 shadow-sm font-medium'
                    : 'text-gray-400 hover:text-gray-600',
                )}
              >
                <Layers size={11} />
                堆积比例
              </button>
            </div>

            {/* Global chart settings */}
            <ChartSettingsPanel
              config={globalConfig}
              onChange={handleConfigChange}
            />

            {isAdmin && (
              <button
                onClick={() => setEditorOpen(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all"
              >
                编辑分组
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Cross-dataset picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 flex-shrink-0">数据集对比</span>
          <DatasetPicker
            datasets={allDatasets}
            currentId={dataset.id}
            selectedId={compareDatasetId}
            onSelect={setCompareDatasetId}
          />
          {compareDataset && (
            <span className="text-[11px] text-gray-400">
              共 {commonCount} 个相同字段
              {commonCount === 0 && <span className="text-amber-500 ml-1">（无可对比字段）</span>}
            </span>
          )}
          {compareDataset && commonCount > 0 && (
            <span className="text-[10px] text-gray-300 ml-1">百分比 = 各数据集总量占比</span>
          )}
        </div>

        {/* Row 3: Dimension chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400 flex-shrink-0">对比维度</span>
          {allPersonaFields.map(f => {
            const active    = selectedDimKeys.includes(f.key);
            const available = !commonFieldKeys || commonFieldKeys.has(f.key);
            return (
              <button
                key={f.key}
                onClick={() => available && toggleDim(f.key)}
                disabled={!available}
                title={!available ? '该字段在对比数据集中不存在' : undefined}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-lg border transition-all',
                  !available
                    ? 'opacity-30 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200'
                    : active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300',
                )}
              >
                {f.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── AI Insight ── */}
      {selectedGroupKeys.length > 0 && personaFields.length > 0 && (
        <AIInsightPanel
          label={insightLabel}
          cacheKey={insightCacheKey}
          cachedResult={viewConfig.insightResults?.[insightCacheKey]}
          onCache={(key, result) =>
            updateViewConfig(dataset.id, {
              insightResults: { ...(viewConfig.insightResults ?? {}), [key]: result },
            })
          }
          defaultPrompt={STATUS_DEFAULT_PROMPT}
          savedPrompt={viewConfig.viewPrompts?.['status']}
          onPromptSave={p =>
            updateViewConfig(dataset.id, {
              viewPrompts: { ...(viewConfig.viewPrompts ?? {}), status: p },
            })
          }
          buildContext={buildStatusContext}
        />
      )}

      {/* ── Charts grid ── */}
      {selectedGroupKeys.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          请选择至少一个状态
        </div>
      ) : compareDataset && commonCount === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          所选对比数据集与当前数据集没有相同字段（按字段 key 匹配）
        </div>
      ) : personaFields.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          请选择要对比的维度
        </div>
      ) : chartMode === 'proportion' ? (
        <div className="grid grid-cols-2 gap-4">
          {personaFields.map(field => (
            <ProportionStackedCard
              key={field.key}
              field={field}
              dataset={dataset}
              statusFieldKey={viewConfig.statusFieldKey!}
              selectedGroups={selectedGroups}
              config={globalConfig}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {personaFields.map(field => (
            <StatusChartCard
              key={field.key}
              field={field}
              dataset={dataset}
              statusFieldKey={viewConfig.statusFieldKey!}
              selectedGroups={selectedGroups}
              config={globalConfig}
              compareDataset={compareDataset}
            />
          ))}
        </div>
      )}

      {/* Group editor */}
      {editorOpen && (
        <StatusGroupEditor
          allValues={allStatusValues}
          groups={groups}
          onSave={handleSaveGroups}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
