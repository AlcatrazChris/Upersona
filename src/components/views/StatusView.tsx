'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, X, ChevronDown, BarChart2, Layers, Search, Check, MapPin } from 'lucide-react';
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
  selectedKeys,
  availableKeys,
  onToggle,
}: {
  fields: Field[];
  selectedKeys: string[];
  availableKeys: Set<string> | null;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visibleFields = fields.filter(field =>
    !search || field.name.toLowerCase().includes(search.toLowerCase()),
  );

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
          <div className="absolute left-0 top-9 z-50 flex max-h-80 min-w-[280px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
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
              {visibleFields.map(field => {
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
                      selected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white',
                    )}>
                      {selected && <Check size={11} />}
                    </span>
                    <span className="flex-1 truncate">{field.name}</span>
                    {!available && <span className="text-[10px]">对比数据集缺失</span>}
                  </button>
                );
              })}
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
  const groups = useMemo<StatusGroup[]>(() => {
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
  const monthOptions = useMemo(() => groups.map(group => group.key), [groups]);
  const monthLabels = useMemo(
    () => Object.fromEntries(groups.map(group => [group.key, group.label])),
    [groups],
  );
  const dateBlocks = useMemo(
    () => viewConfig.dateBlocks?.length
      ? viewConfig.dateBlocks
      : (timeField ? getDefaultDateBlocks(dataset, timeField) : []),
    [dataset, timeField, viewConfig.dateBlocks],
  );

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

  const [selectedGroupKeys, setSelectedGroupKeys] = useUrlArrayState('status_month');
  const [selectedOrderStatuses, setSelectedOrderStatuses] =
    useUrlArrayState('status_order', ['__all']);
  const [geoLevel, setGeoLevel] = useUrlStringState<GeoLevel>(
    'status_geo_level', 'region', ['region', 'province', 'city'],
  );
  const [selectedGeo, setSelectedGeo] = useUrlArrayState('status_geo');
  const [selectedDimKeys, setSelectedDimKeys] =
    useUrlArrayState('status_dimensions', initFieldKeys);
  const [compareDatasetId,  setCompareDatasetId]  = useState<string | null>(null);
  const [chartMode, setChartMode] = useUrlStringState<'dimension' | 'proportion'>(
    'status_mode', 'dimension', ['dimension', 'proportion'],
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
  const geoLevels = ([
    { key: 'region' as GeoLevel, label: '大区', fieldKey: viewConfig.geoRegionKey },
    { key: 'province' as GeoLevel, label: '省份', fieldKey: viewConfig.geoProvinceKey },
    { key: 'city' as GeoLevel, label: '城市', fieldKey: viewConfig.geoCityKey },
  ] as const).filter(level => level.fieldKey);

  useEffect(() => {
    if (geoLevels.length === 0 || geoLevels.some(level => level.key === geoLevel)) return;
    setGeoLevel(geoLevels[0].key);
    setSelectedGeo([]);
  }, [geoLevel, geoLevels, setGeoLevel, setSelectedGeo]);

  const selectedGroups  = groups.filter(g => selectedGroupKeys.includes(g.key));
  const analysisDataset = useMemo<Dataset>(() => {
    const filtered = filterRecords(
      dataset.records,
      viewConfig,
      geoLevel,
      selectedGeo,
      selectedOrderStatuses,
    );
    return {
      ...dataset,
      records: filtered.map(record => ({
        ...record,
        [MONTH_FIELD_KEY]: timeField ? dateBlockForValue(record[timeField.key], dateBlocks) ?? '' : '',
      })),
      rowCount: filtered.length,
    };
  }, [dataset, timeField, dateBlocks, viewConfig, geoLevel, selectedGeo, selectedOrderStatuses]);

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
      selectedOrderStatuses,
    );
    if (!compareTimeField) {
      return { ...selectedDataset, records: orderFiltered, rowCount: orderFiltered.length };
    }
    const records = orderFiltered.map(record => ({
      ...record,
      [MONTH_FIELD_KEY]: dateBlockForValue(record[compareTimeField.key], dateBlocks) ?? '',
    }));
    return {
      ...selectedDataset,
      records,
      rowCount: records.length,
    };
  }, [selectedDataset, geoLevel, selectedGeo, selectedOrderStatuses, viewConfig, dateBlocks]);

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
    const selected = new Set(selectedGroupKeys);
    return analysisDataset.records.filter(record =>
      selected.has(String(record[MONTH_FIELD_KEY] ?? '')),
    );
  }, [analysisDataset.records, selectedGroupKeys]);

  const toggleDim = (key: string) =>
    setSelectedDimKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );

  // ── AI Insight helpers ─────────────────────────────
  const insightCacheKey = `status_month_${selectedGroupKeys.join(',')}_${geoLevel}_${selectedGeo.join(',')}_${selectedDimKeys.join(',')}_${compareDatasetId ?? ''}`;
  const insightLabel = selectedGroups.length === 0
    ? '（请先选择月份）'
    : `${selectedGroups.map(g => g.label).join(' vs ')} · ${
      selectedGeo.length > 0 ? selectedGeo.join(' / ') : '全国'
    } · ${personaFields.map(f => f.name).join('、').slice(0, 30)}`;

  const STATUS_DEFAULT_PROMPT = `分析上方各月份数据，找出用户特征与偏好的月度变化。禁止开场白、总结段落、套话。

## 月度变化（≤3条）
格式：[维度]——[月份A]【XX%】vs[月份B]【XX%】，变化XX%→[判断]

## 趋势与建议（≤2条）
格式：[变化趋势]——[具体行动建议]

只引用上方真实数据，每条≤40字，不输出其他任何内容。`;

  function buildStatusContext() {
    return {
      analysisType:  'month_comparison',
      dataset:       dataset.name,
      months:        selectedGroups.map(g => g.label),
      dimensions:    personaFields.map(f => f.name),
      totalSamples:  filteredRecords.length,
      timeField:     timeField?.name,
      geography:     selectedGeo.length > 0 ? selectedGeo : ['全国'],
      note:          compareDataset
        ? `与对比数据集「${compareDataset.name}」（${compareDataset.rowCount} 行）进行跨数据集月份对比`
        : undefined,
    };
  }

  if (!timeField || groups.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center text-sm text-gray-500">
        <p>未识别到有效的时间字段。请上传包含日期时间列的数据，系统会自动按月份生成对比图表。</p>
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

        {/* Row 1: Unified selectable status groups + chart settings */}
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <StatusFilterGroups
              orderOptions={orderOptions}
              selectedOrders={selectedOrderStatuses}
              onOrdersChange={setSelectedOrderStatuses}
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 flex-shrink-0">筛选地区</span>
            <div className="flex items-center gap-0.5 rounded-xl bg-gray-100 p-0.5">
              {geoLevels.map(level => (
                <button
                  type="button"
                  key={level.key}
                  onClick={() => {
                    setGeoLevel(level.key);
                    setSelectedGeo([]);
                  }}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs transition-all',
                    geoLevel === level.key
                      ? 'bg-white font-medium text-gray-800 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <GeoMultiSelect
              dataset={dataset}
              viewConfig={viewConfig}
              geoLevel={geoLevel}
              selected={selectedGeo}
              onChange={setSelectedGeo}
            />
          </div>
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
            selectedKeys={selectedDimKeys}
            availableKeys={commonFieldKeys}
            onToggle={toggleDim}
          />
          {selectedDimKeys.length > 0 && (
            <span className="text-[11px] text-gray-400">
              可保持下拉框打开并连续选择
            </span>
          )}
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
          请选择至少一个月份
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
              statusFieldKey={MONTH_FIELD_KEY}
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
              statusFieldKey={MONTH_FIELD_KEY}
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
