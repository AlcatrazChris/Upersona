'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, X, ChevronDown, BarChart2, Layers, Search, Check, MapPin, GripVertical } from 'lucide-react';
import {
  aggregateField,
  aggregateByStatusGroups,
  aggregateCrossDatasetByStatus,
} from '@/lib/dataAggregator';
import { ChartRenderer, GroupChartRenderer } from '@/components/charts/engine/ChartRenderer';
import { ChartTypeSwitcher, useResizableChartHeight } from '@/components/charts/engine/shared';
import { ChartSettingsPanel }       from '@/components/charts/ChartSettingsPanel';
import { AIInsightPanel }           from '@/components/shared/AIInsightPanel';
import { StatusFilterGroups }       from '@/components/shared/StatusFilterGroups';
import { GeoFilterGroup }           from '@/components/shared/GeoFilterGroup';
import {
  filterRecords,
  getGeoOptionsWithCount,
  getStatusOptions,
  type GeoLevel,
} from '@/lib/filterRecords';
import {
  DEFAULT_CHART_CONFIG,
  loadChartConfig,
  saveChartConfig,
  getContrastingColors,
  type ChartConfig,
} from '@/lib/chartConfig';
import { useDatasetStore }          from '@/store/datasetStore';
import { cn } from '@/lib/utils';
import type { Dataset, Field } from '@/types/dataSchema';
import type { ViewConfig, StatusGroup } from '@/lib/viewConfig';
import type { FlatChartType } from '@/components/charts/engine/ChartRenderer';
import {
  dateBlockForValue, detectTimeField, getDefaultDateBlocks,
} from '@/lib/timeStatus';
import { useUrlArrayState, useUrlStringState } from '@/hooks/useUrlParamState';
import { formatStatusDimensionComparison, reorderSelectedKeys } from '@/lib/statusInsight';
import { PERSONA_ROLE_META, roleForField, type PersonaSemanticRole } from '@/lib/personaTemplate';

const MONTH_FIELD_KEY = '__upersona_month';

// ── Intent styling ─────────────────────────────────────────────

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
  const [dsSearch, setDsSearch] = useState('');
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
          <div className="absolute z-50 top-9 left-0 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[200px] max-h-64 flex flex-col">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-100">
              <Search size={10} className="text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                value={dsSearch}
                onChange={e => setDsSearch(e.target.value)}
                placeholder="搜索数据集…"
                className="w-full text-xs bg-transparent outline-none placeholder:text-gray-300"
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto flex-1 py-1.5">
              {(dsSearch
                ? options.filter(d => d.name.toLowerCase().includes(dsSearch.toLowerCase()))
                : options
              ).map(d => (
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
  const [chartType, setChartType] = useState<FlatChartType | null>(null);

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

  const monthDonutData = useMemo(() => {
    if (isCross || (chartType !== 'pie' && chartType !== 'donut')) return [];
    return selectedGroups.map(group => {
      const records = dataset.records.filter(record =>
        group.values.includes(String(record[statusFieldKey] ?? '')),
      );
      return { group, records, items: aggregateField(records, field) };
    });
  }, [chartType, dataset.records, field, isCross, selectedGroups, statusFieldKey]);

  // ── Height ──
  // Use global config.chartHeight; if that's too small for the data, expand automatically
  const rowCount  = isSingle ? (singleData?.items.length ?? 0)
                 : isCross  ? (crossData?.items.length  ?? 0)
                 :             (multiData?.items.length  ?? 0);
  const seriesCnt = isSingle ? 1 : isCross ? selectedGroups.length * 2 : selectedGroups.length;
  const dataH     = Math.max(180, Math.min(rowCount * (seriesCnt * 14 + 8) + 54, 420));
  const { height: chartH, onResizeStart, onResizeKeyDown } = useResizableChartHeight(
    Math.max(Math.min(config.chartHeight, 240), dataH),
    160,
  );
  const resolvedChartType: FlatChartType = chartType ?? 'bar';
  const useCircularCharts = !isCross && (resolvedChartType === 'pie' || resolvedChartType === 'donut');

  // ── Colors ──
  const crossColors = getContrastingColors(
    config.colorScheme,
    selectedGroups.length * 2,
  );
  const multiColors = getContrastingColors(
    config.colorScheme,
    selectedGroups.length,
  );

  // ── Subtitle ──
  const subtitle = isSingle ? (
    <span className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: multiColors[0] }} />
      {selectedGroups[0].label}
      <span className="text-gray-300">·</span>
      有效样本 n={(singleData?.n ?? 0).toLocaleString()}
    </span>
  ) : isCross ? (
    <span className="flex items-center gap-2 flex-wrap">
      <span className="text-violet-500 font-medium">{dataset.name}</span>
      <span className="text-gray-300">vs</span>
      <span className="text-violet-500 font-medium">{compareDataset!.name}</span>
      {selectedGroups.map((g, index) => (
        <span key={g.key} className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: crossColors[index * 2] }} />
          {g.label}
        </span>
      ))}
    </span>
  ) : (
    <span className="flex items-center gap-2 flex-wrap">
      {selectedGroups.map((g, index) => (
        <span key={g.key} className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: multiColors[index] }} />
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
    <div className="bg-white rounded-2xl border border-gray-100 p-4 relative group select-none">

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-800">{field.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Each card can independently switch chart type. */}
        {!isCross && (
          <ChartTypeSwitcher
            value={resolvedChartType}
            options={['bar', 'pie', 'donut'] as const}
            onChange={setChartType}
          />
        )}
      </div>

      {/* Chart */}
      {useCircularCharts ? (
        <div className={cn(
          'grid gap-2',
          selectedGroups.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
        )}>
          {monthDonutData.map(({ group, records, items }) => (
            <div key={group.key} className="min-w-0">
              {selectedGroups.length > 1 && (
                <div className="mb-1 text-center text-[11px] font-medium text-gray-500">
                  {group.label} · n={records.length.toLocaleString()}
                </div>
              )}
              <ChartRenderer
                type={resolvedChartType}
                data={items}
                config={{ ...singleCfg, chartHeight: chartH }}
                isMultiSelect={field.type === 'multi_choice'}
                totalSamples={records.length}
                height={chartH}
              />
            </div>
          ))}
        </div>
      ) : isSingle && singleData ? (
        <ChartRenderer
          type={resolvedChartType}
          data={singleData.items.slice(0, 10)}
          config={singleCfg}
          isMultiSelect={field.type === 'multi_choice'}
          totalSamples={singleData.n}
          height={chartH}
        />
      ) : isCross && crossData ? (
        <GroupChartRenderer
          type="grouped"
          data={crossData}
          config={multiCfg}
          height={chartH}
          seriesColors={crossColors}
          autoHeight={false}
        />
      ) : multiData ? (
        <GroupChartRenderer
          type="grouped"
          data={multiData}
          config={multiCfg}
          height={chartH}
          seriesColors={multiColors}
          autoHeight={false}
        />
      ) : null}

      {/* Resize handle */}
      <button
        type="button"
        onMouseDown={onResizeStart}
        onKeyDown={onResizeKeyDown}
        className="absolute bottom-1.5 left-1/2 flex h-4 w-16 -translate-x-1/2 cursor-ns-resize items-center justify-center opacity-40 transition-opacity hover:opacity-100 focus:opacity-100"
        aria-label="调整图表高度；使用上下方向键微调，Home 恢复默认"
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full hover:bg-blue-300 transition-colors" />
      </button>
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
  const data = useMemo(
    () => aggregateByStatusGroups(
      dataset.records,
      field,
      statusFieldKey,
      selectedGroups,
    ),
    [dataset.records, field, selectedGroups, statusFieldKey],
  );
  const chartH = Math.max(180, selectedGroups.length * 48 + 80);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 col-span-2">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{field.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">各状态群体占比分布</p>
      </div>
      <GroupChartRenderer
        type="stacked"
        data={data}
        config={{ ...config, chartHeight: chartH }}
        height={chartH}
      />
    </div>
  );
}

function DimensionMultiSelect({
  fields,
  categories,
  selectedKeys,
  availableKeys,
  onToggle,
  onReorder,
}: {
  fields: Field[];
  categories: Array<{ key: PersonaSemanticRole; label: string; fields: Field[] }>;
  selectedKeys: string[];
  availableKeys: Set<string> | null;
  onToggle: (key: string) => void;
  onReorder: (fromKey: string, toKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const selectedFields = selectedKeys
    .map(key => fields.find(field => field.key === key))
    .filter((field): field is Field => !!field);
  const visibleCategories = categories
    .map(category => ({
      ...category,
      fields: category.fields.filter(field =>
        !search || field.name.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter(category => category.fields.length > 0);

  function renderField(field: Field) {
    const available = !availableKeys || availableKeys.has(field.key);
    const selected = selectedKeys.includes(field.key);
    return (
      <button
        type="button"
        key={field.key}
        disabled={!available}
        onClick={() => available && onToggle(field.key)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-xs',
          available ? 'text-gray-700 hover:bg-blue-50' : 'cursor-not-allowed text-gray-300',
        )}
      >
        <span className={cn(
          'flex h-4 w-4 items-center justify-center rounded border',
          selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white',
        )}>
          {selected && <Check size={11} />}
        </span>
        <span className="flex-1 truncate">{field.name}</span>
        {!available && <span className="text-[10px]">对比数据集缺失</span>}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex min-w-[180px] items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300"
      >
        <span>
          {selectedKeys.length > 0 ? `已选择 ${selectedKeys.length} 个维度` : '选择对比维度'}
        </span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-50 flex max-h-[460px] min-w-[340px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search size={12} className="text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="搜索维度…"
                className="w-full bg-transparent text-xs outline-none placeholder:text-gray-300"
              />
            </div>
            <div className="overflow-y-auto py-1">
              {selectedFields.length > 0 && !search && (
                <div className="border-b border-gray-100 px-2 pb-2">
                  <div className="px-1 py-2 text-[11px] font-medium text-gray-400">图表顺序 · 拖动调整</div>
                  {selectedFields.map((field, index) => (
                    <div
                      key={field.key}
                      draggable
                      onDragStart={() => setDraggingKey(field.key)}
                      onDragOver={event => event.preventDefault()}
                      onDrop={() => {
                        if (draggingKey) onReorder(draggingKey, field.key);
                        setDraggingKey(null);
                      }}
                      onDragEnd={() => setDraggingKey(null)}
                      className={cn(
                        'flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 active:cursor-grabbing',
                        draggingKey === field.key && 'bg-blue-50 opacity-60',
                      )}
                    >
                      <GripVertical size={13} className="text-gray-300" />
                      <span className="w-5 text-right tabular-nums text-gray-400">{index + 1}</span>
                      <span className="flex-1 truncate">{field.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {visibleCategories.map(category => (
                <div key={category.key} className="py-1">
                  <div className="sticky top-0 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-gray-400 backdrop-blur-sm">
                    {category.label}
                  </div>
                  {category.fields.map(renderField)}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
              <span>可连续勾选多个维度</span>
              <button type="button" onClick={() => setOpen(false)} className="text-blue-600">
                完成
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GeoMultiSelect({
  dataset,
  viewConfig,
  geoLevel,
  selected,
  onChange,
}: {
  dataset: Dataset;
  viewConfig: ViewConfig;
  geoLevel: GeoLevel;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const options = useMemo(
    () => getGeoOptionsWithCount(dataset.records, viewConfig, geoLevel),
    [dataset.records, viewConfig, geoLevel],
  );
  const levelLabel = geoLevel === 'region' ? '大区' : geoLevel === 'province' ? '省份' : '城市';
  const visibleOptions = search
    ? options.filter(option => option.value.includes(search))
    : options;
  const label = selected.length === 0
    ? `全部${levelLabel}`
    : selected.length === 1
      ? selected[0]
      : `${selected.length} 个${levelLabel}`;

  function close() {
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={cn(
          'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-all',
          selected.length > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300',
        )}
      >
        <MapPin size={11} />
        {label}
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute left-0 top-9 z-50 flex max-h-72 w-60 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search size={11} className="text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={event => setSearch(event.target.value)}
                onKeyDown={event => event.key === 'Escape' && close()}
                placeholder={`搜索${levelLabel}…`}
                className="w-full bg-transparent text-xs outline-none placeholder:text-gray-300"
              />
            </div>
            <div className="overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  close();
                }}
                className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
              >
                全部（不筛选）
              </button>
              {visibleOptions.map(({ value, count }) => {
                const checked = selected.includes(value);
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => onChange(
                      checked
                        ? selected.filter(item => item !== value)
                        : [...selected, value],
                    )}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-blue-50',
                      checked ? 'font-medium text-blue-700' : 'text-gray-700',
                    )}
                  >
                    <span className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300',
                    )}>
                      {checked && <Check size={11} />}
                    </span>
                    <span className="flex-1 truncate">{value}</span>
                    <span className="text-[10px] text-gray-400">n={count.toLocaleString()}</span>
                  </button>
                );
              })}
              {visibleOptions.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-gray-400">无匹配地区</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── StatusView ─────────────────────────────────────────────────

interface Props {
  dataset:    Dataset;
  viewConfig: ViewConfig;
  onOpenDataCenter?: () => void;
}

export function StatusView({ dataset, viewConfig, onOpenDataCenter }: Props) {
  const { updateViewConfig, datasets: allDatasets, personaConfigs, activePersonaConfigId } = useDatasetStore();

  const configs      = personaConfigs[dataset.id] ?? [];
  const activeConfig = configs.find(c => c.id === activePersonaConfigId);
  const timeField = useMemo(() => detectTimeField(dataset), [dataset]);
  const timeGroups = useMemo<StatusGroup[]>(() => {
    if (!timeField) return [];
    const blocks = viewConfig.dateBlocks?.length
      ? viewConfig.dateBlocks
      : getDefaultDateBlocks(dataset, timeField);
    return blocks.map(block => ({
      key: block.key,
      label: block.label,
      values: [block.key],
      color: 'blue',
      intent: 'neutral',
    }));
  }, [dataset, timeField, viewConfig.dateBlocks]);
  const monthOptions = useMemo(() => timeGroups.map(group => group.key), [timeGroups]);
  const monthLabels = useMemo(
    () => Object.fromEntries(timeGroups.map(group => [group.key, group.label])),
    [timeGroups],
  );
  const dateBlocks = useMemo(
    () => viewConfig.dateBlocks?.length
      ? viewConfig.dateBlocks
      : (timeField ? getDefaultDateBlocks(dataset, timeField) : []),
    [dataset, timeField, viewConfig.dateBlocks],
  );

  // Derive the initial field keys respecting persona config order
  const initFieldKeys = (() => {
    if (viewConfig.personaFieldKeys?.length) {
      return viewConfig.personaFieldKeys.slice(0, 6);
    }
    if (activeConfig) {
      return activeConfig.blocks
        .filter(b => b.visible && b.sourceFieldKey)
        .map(b => b.sourceFieldKey!)
        .slice(0, 6);
    }
    return (viewConfig.personaFieldKeys ?? []).slice(0, 6);
  })();

  const [selectedGroupKeys, setSelectedGroupKeys] = useUrlArrayState('filter_time');
  const [selectedOrderStatuses, setSelectedOrderStatuses] =
    useUrlArrayState('filter_order', ['__all']);
  const [geoLevel, setGeoLevel] = useUrlStringState<GeoLevel>(
    'filter_geo_level', 'all', ['all', 'region', 'province', 'city'],
  );
  const [selectedGeo, setSelectedGeo] = useUrlArrayState('filter_geo');
  const [selectedDimKeys, setSelectedDimKeys] =
    useUrlArrayState('status_dimensions', initFieldKeys);
  const [compareDatasetId,  setCompareDatasetId]  = useState<string | null>(null);
  const [chartMode, setChartMode] = useUrlStringState<'dimension' | 'proportion'>(
    'status_mode', 'dimension', ['dimension', 'proportion'],
  );
  const [compareBasis, setCompareBasis] = useUrlStringState<'time' | 'order'>(
    'status_compare_by', timeField ? 'time' : 'order', ['time', 'order'],
  );
  const [globalConfig,      setGlobalConfig]      = useState<ChartConfig>(
    () => {
      const saved = loadChartConfig('status');
      return {
        ...DEFAULT_CHART_CONFIG,
        ...saved,
        chartHeight: Math.min(saved.chartHeight, 220),
        compact: true,
      };
    },
  );

  useEffect(() => {
    setSelectedGroupKeys(current => {
      const valid = current.filter(month => monthOptions.includes(month));
      return valid.length > 0 ? valid : monthOptions.slice(0, 2);
    });
  }, [dataset.id, monthOptions]);

  const handleConfigChange = (c: ChartConfig) => {
    setGlobalConfig(c);
    saveChartConfig('status', c);
  };

  const orderOptions = useMemo(
    () => getStatusOptions(dataset.records, viewConfig),
    [dataset.records, viewConfig],
  );
  const orderGroups = useMemo<StatusGroup[]>(() => {
    if (viewConfig.statusGroups?.length) return viewConfig.statusGroups;
    return orderOptions.map((value, index) => ({
      key: `status_${index}`,
      label: value,
      values: [value],
      color: 'blue',
      intent: 'neutral',
    }));
  }, [orderOptions, viewConfig.statusGroups]);

  useEffect(() => {
    if (compareBasis === 'time' && !timeField && orderGroups.length) setCompareBasis('order');
    if (compareBasis === 'order' && !orderGroups.length && timeField) setCompareBasis('time');
    if (compareBasis === 'order' && orderOptions.length && selectedOrderStatuses.includes('__all')) {
      setSelectedOrderStatuses(orderOptions.slice(0, 2));
    }
  }, [compareBasis, orderGroups.length, orderOptions, selectedOrderStatuses, setCompareBasis, setSelectedOrderStatuses, timeField]);
  const geoLevels = ([
    { key: 'region' as GeoLevel, label: '大区', fieldKey: viewConfig.geoRegionKey },
    { key: 'province' as GeoLevel, label: '省份', fieldKey: viewConfig.geoProvinceKey },
    { key: 'city' as GeoLevel, label: '城市', fieldKey: viewConfig.geoCityKey },
  ] as const).filter(level => level.fieldKey);

  useEffect(() => {
    if (geoLevel === 'all' || geoLevels.length === 0 || geoLevels.some(level => level.key === geoLevel)) return;
    setGeoLevel(geoLevels[0].key);
    setSelectedGeo([]);
  }, [geoLevel, geoLevels, setGeoLevel, setSelectedGeo]);

  const selectedTimeGroups = timeGroups.filter(group => selectedGroupKeys.includes(group.key));
  const selectedOrderGroups = orderGroups.filter(group => selectedOrderStatuses.includes(group.label));
  const selectedGroups = compareBasis === 'time' ? selectedTimeGroups : selectedOrderGroups;
  const comparisonFieldKey = compareBasis === 'time' ? MONTH_FIELD_KEY : (viewConfig.statusFieldKey ?? '');
  const analysisDataset = useMemo<Dataset>(() => {
    const filtered = filterRecords(
      dataset.records,
      viewConfig,
      geoLevel,
      selectedGeo,
      compareBasis === 'time' ? selectedOrderStatuses : ['__all'],
    );
    const selectedTimes = new Set(selectedGroupKeys);
    const records = filtered.map(record => ({
      ...record,
      [MONTH_FIELD_KEY]: timeField ? dateBlockForValue(record[timeField.key], dateBlocks) ?? '' : '',
    })).filter(record => compareBasis === 'time' || !timeField || selectedTimes.has(String(record[MONTH_FIELD_KEY] ?? '')));
    return {
      ...dataset,
      records,
      rowCount: records.length,
    };
  }, [compareBasis, dataset, timeField, dateBlocks, viewConfig, geoLevel, selectedGeo, selectedOrderStatuses, selectedGroupKeys]);

  const selectedDataset = useMemo(
    () => compareDatasetId ? allDatasets.find(d => d.id === compareDatasetId) : undefined,
    [compareDatasetId, allDatasets],
  );

  const compareDataset = useMemo<Dataset | undefined>(() => {
    if (!selectedDataset) return undefined;
    const compareTimeField = detectTimeField(selectedDataset);
    const orderFiltered = filterRecords(
      selectedDataset.records,
      viewConfig,
      geoLevel,
      selectedGeo,
      compareBasis === 'time' ? selectedOrderStatuses : ['__all'],
    );
    if (!compareTimeField) {
      return { ...selectedDataset, records: orderFiltered, rowCount: orderFiltered.length };
    }
    const selectedTimes = new Set(selectedGroupKeys);
    const records = orderFiltered.map(record => ({
      ...record,
      [MONTH_FIELD_KEY]: dateBlockForValue(record[compareTimeField.key], dateBlocks) ?? '',
    })).filter(record => compareBasis === 'time' || selectedTimes.has(String(record[MONTH_FIELD_KEY] ?? '')));
    return {
      ...selectedDataset,
      records,
      rowCount: records.length,
    };
  }, [selectedDataset, geoLevel, selectedGeo, selectedOrderStatuses, viewConfig, dateBlocks, compareBasis, selectedGroupKeys]);

  const commonFieldKeys = useMemo(() => {
    if (!compareDataset) return null;
    const cKeys = new Set(compareDataset.fields.map(f => f.key));
    return new Set((viewConfig.personaFieldKeys ?? []).filter(k => cKeys.has(k)));
  }, [compareDataset, viewConfig.personaFieldKeys]);

  const allPersonaFields = useMemo(() => {
    if (viewConfig.personaFieldKeys?.length) {
      return viewConfig.personaFieldKeys
        .map(key => dataset.fields.find(field => field.key === key))
        .filter((field): field is Field =>
          !!field && field.key !== timeField?.key && field.key !== viewConfig.statusFieldKey
        );
    }
    if (activeConfig) {
      return activeConfig.blocks
        .filter(b => b.visible && b.sourceFieldKey)
        .map(b => dataset.fields.find(f => f.key === b.sourceFieldKey))
        .filter((field): field is Field =>
          !!field && field.key !== timeField?.key && field.key !== viewConfig.statusFieldKey
        );
    }
    return (viewConfig.personaFieldKeys ?? [])
      .map(k => dataset.fields.find(f => f.key === k))
      .filter((field): field is Field =>
        !!field && field.key !== timeField?.key && field.key !== viewConfig.statusFieldKey
      );
  }, [dataset.fields, viewConfig.personaFieldKeys, viewConfig.statusFieldKey, activeConfig, timeField]);

  const dimensionCategories = useMemo(() => {
    const grouped = new Map<PersonaSemanticRole, Field[]>();
    for (const field of allPersonaFields) {
      const role = roleForField(field, viewConfig.personaRoles);
      if (role === 'metadata') continue;
      grouped.set(role, [...(grouped.get(role) ?? []), field]);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => PERSONA_ROLE_META[a].order - PERSONA_ROLE_META[b].order)
      .map(([key, fields]) => ({ key, label: PERSONA_ROLE_META[key].label, fields }));
  }, [allPersonaFields, viewConfig.personaRoles]);

  const personaFields = useMemo(
    () => selectedDimKeys
      .filter(k => !commonFieldKeys || commonFieldKeys.has(k))
      .map(k => dataset.fields.find(f => f.key === k))
      .filter((field): field is Field =>
        !!field && field.key !== timeField?.key && field.key !== viewConfig.statusFieldKey
      ),
    [dataset.fields, selectedDimKeys, commonFieldKeys, timeField, viewConfig.statusFieldKey],
  );

  const filteredRecords = useMemo(() => {
    return analysisDataset.records.filter(record => selectedGroups.some(group =>
      group.values.includes(String(record[comparisonFieldKey] ?? '')),
    ));
  }, [analysisDataset.records, comparisonFieldKey, selectedGroups]);

  const toggleDim = (key: string) =>
    setSelectedDimKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );

  // ── AI Insight helpers ─────────────────────────────
  const insightCacheKey = `status_${compareBasis}_${selectedGroups.map(group => group.key).join(',')}_${geoLevel}_${selectedGeo.join(',')}_${selectedDimKeys.join(',')}_${compareDatasetId ?? ''}`;
  const insightLabel = selectedGroups.length === 0
    ? `（请先选择${compareBasis === 'time' ? '时间' : '订单状态'}）`
    : `${selectedGroups.map(g => g.label).join(' vs ')} · ${
      selectedGeo.length > 0 ? selectedGeo.join(' / ') : '全国'
    } · ${personaFields.map(f => f.name).join('、').slice(0, 30)}`;

  const STATUS_DEFAULT_PROMPT = `根据 dimensionComparisons 逐一分析状态对比。每个维度都必须输出，不得遗漏、合并或只选变化较大的维度。

## 逐维度变化
按 dimensionComparisons 的输入顺序，每个维度使用一个“### 维度名”小标题，并输出：
- 变化：引用各对比组的具体选项和占比，说明最主要的升降或结构变化。
- 判断：用1句话解释该维度的趋势。如无明显变化，明确写“结构基本稳定”并引用最大差值。

## 总体趋势
用2—4句话概括跨维度的共同变化，不重复罗列逐维度结论。

## 建议
输出2—4条可执行建议，每条对应前文数据。

占比差用“百分点”表达，不将百分点误写为增长率。只引用上下文中的真实数据。`;

  function buildStatusContext() {
    const dimensionComparisons = personaFields.map(field => {
      const grouped = compareDataset
        ? aggregateCrossDatasetByStatus(
            { records: analysisDataset.records, label: dataset.name },
            { records: compareDataset.records, label: compareDataset.name },
            field, comparisonFieldKey, selectedGroups,
          )
        : aggregateByStatusGroups(
            analysisDataset.records, field, comparisonFieldKey, selectedGroups,
          );
      return formatStatusDimensionComparison(field.name, grouped);
    });

    return {
      analysisType:  compareBasis === 'time' ? 'time_comparison' : 'order_status_comparison',
      dataset:       dataset.name,
      comparisonGroups: selectedGroups.map(g => g.label),
      dimensions:    personaFields.map(f => f.name),
      totalSamples:  filteredRecords.length,
      comparisonField: compareBasis === 'time' ? timeField?.name : viewConfig.statusFieldKey,
      geography:     selectedGeo.length > 0 ? selectedGeo : ['全国'],
      dimensionComparisons,
      note:          compareDataset
        ? `与对比数据集「${compareDataset.name}」（${compareDataset.rowCount} 行）进行跨数据集月份对比`
        : undefined,
    };
  }

  if ((!timeField || timeGroups.length === 0) && orderGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center text-sm text-gray-500">
        <p>未识别到可用于对比的订单状态或时间字段，请先在数据中心完成全局状态设置。</p>
        {onOpenDataCenter && (
          <button
            type="button"
            onClick={onOpenDataCenter}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            打开数据中心
          </button>
        )}
      </div>
    );
  }

  const commonCount = commonFieldKeys?.size ?? 0;

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">对比方式</span>
          <div className="flex items-center gap-0.5 rounded-xl bg-gray-100 p-0.5">
            <button type="button" disabled={!orderGroups.length} onClick={() => {
              setCompareBasis('order');
              if (selectedOrderStatuses.includes('__all')) setSelectedOrderStatuses(orderOptions.slice(0, 2));
            }} className={cn('rounded-lg px-3 py-1 text-xs transition-all disabled:opacity-40', compareBasis === 'order' ? 'bg-white font-medium text-gray-800 shadow-sm' : 'text-gray-500')}>订单状态对比</button>
            <button type="button" disabled={!timeField || !timeGroups.length} onClick={() => setCompareBasis('time')}
              className={cn('rounded-lg px-3 py-1 text-xs transition-all disabled:opacity-40', compareBasis === 'time' ? 'bg-white font-medium text-gray-800 shadow-sm' : 'text-gray-500')}>时间对比</button>
          </div>
          <span className="text-[10px] text-gray-400">
            {compareBasis === 'time' ? '时间作为图表系列，订单状态用于筛选' : '订单状态作为图表系列，时间用于筛选'}
          </span>
        </div>

        {/* Row 1: Unified selectable status groups + chart settings */}
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <StatusFilterGroups
              orderOptions={orderOptions}
              selectedOrders={selectedOrderStatuses}
              onOrdersChange={values => setSelectedOrderStatuses(
                compareBasis === 'order' && values.includes('__all') ? orderOptions : values
              )}
              monthOptions={monthOptions}
              monthLabels={monthLabels}
              selectedMonths={selectedGroupKeys}
              onMonthsChange={values =>
                setSelectedGroupKeys(values.includes('__all') ? monthOptions : values)
              }
            />
          </div>
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
              chartTypes={['grouped', 'stacked']}
            />
          </div>
        </div>

        {geoLevels.length > 0 && (
          <GeoFilterGroup
            dataset={dataset}
            viewConfig={viewConfig}
            level={geoLevel}
            selected={selectedGeo}
            onLevelChange={setGeoLevel}
            onChange={setSelectedGeo}
          />
        )}

        {/* Row 2: Cross-dataset picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 flex-shrink-0">数据集对比</span>
          <DatasetPicker
            datasets={allDatasets}
            currentId={dataset.id}
            selectedId={compareDatasetId}
            onSelect={setCompareDatasetId}
          />
          {selectedDataset && (
            <span className="text-[11px] text-gray-400">
              共 {commonCount} 个相同字段
              {commonCount === 0 && <span className="text-amber-500 ml-1">（无可对比字段）</span>}
            </span>
          )}
          {selectedDataset && commonCount > 0 && (
            <span className="text-[10px] text-gray-300 ml-1">百分比 = 各数据集总量占比</span>
          )}
        </div>

        {/* Row 3: Dimension multi-select */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400 flex-shrink-0">对比维度</span>
          <DimensionMultiSelect
            fields={allPersonaFields}
            categories={dimensionCategories}
            selectedKeys={selectedDimKeys}
            availableKeys={commonFieldKeys}
            onToggle={toggleDim}
            onReorder={(fromKey, toKey) =>
              setSelectedDimKeys(keys => reorderSelectedKeys(keys, fromKey, toKey))
            }
          />
          {selectedDimKeys.length > 0 && (
            <span className="text-[11px] text-gray-400">
              可保持下拉框打开并连续选择
            </span>
          )}
        </div>
      </div>

      {/* ── AI Insight ── */}
      {selectedGroups.length > 0 && personaFields.length > 0 && (
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
          maxTokens={2400}
        />
      )}

      {/* ── Charts grid ── */}
      {selectedGroups.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          请选择至少一个{compareBasis === 'time' ? '时间段' : '订单状态'}
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {personaFields.map(field => (
            <ProportionStackedCard
              key={field.key}
              field={field}
              dataset={analysisDataset}
              statusFieldKey={comparisonFieldKey}
              selectedGroups={selectedGroups}
              config={globalConfig}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {personaFields.map(field => (
            <StatusChartCard
              key={field.key}
              field={field}
              dataset={analysisDataset}
              statusFieldKey={comparisonFieldKey}
              selectedGroups={selectedGroups}
              config={globalConfig}
              compareDataset={compareDataset}
            />
          ))}
        </div>
      )}
    </div>
  );
}
