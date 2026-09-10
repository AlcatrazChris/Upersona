'use client';

import { useState, useMemo } from 'react';
import { Filter, MapPin, ChevronDown, Check, Search } from 'lucide-react';
import { aggregateField, aggregateRanking } from '@/lib/dataAggregator';
import { filterRecords, getGeoOptions, getStatusOptions, type GeoLevel } from '@/lib/filterRecords';
import { ChartRenderer, type FlatChartType } from '@/components/charts/engine/ChartRenderer';
import { AdvancedPersonaChartEngine } from '@/components/charts/engine/AdvancedPersonaChartEngine';
import { RankingHeatmapEngine }          from '@/components/charts/engine/RankingHeatmapEngine';
import { ChartSettingsPanel, useStoredChartConfig } from '@/components/charts/ChartSettingsPanel';
import { DEFAULT_CHART_CONFIG, type ChartConfig } from '@/lib/chartConfig';
import type { Dataset, Field } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';
import { useDatasetStore } from '@/store/datasetStore';
import { cn } from '@/lib/utils';
import { StatusFilterGroups } from '@/components/shared/StatusFilterGroups';
import { GeoFilterGroup } from '@/components/shared/GeoFilterGroup';
import { detectTimeField, filterByDateBlocks, getDefaultDateBlocks } from '@/lib/timeStatus';
import { useUrlArrayState, useUrlStringState } from '@/hooks/useUrlParamState';
import { useResizableChartHeight } from '@/components/charts/engine/shared';
import {
  PERSONA_ROLE_META, defaultPersonaChart, roleForField,
  type PersonaChartSpec, type PersonaChartType,
} from '@/lib/personaTemplate';

// ── Geo dropdown (multi-select) ───────────────────────────────

function GeoDropdown({
  options, selected, onChange, placeholder,
}: {
  options:     string[];
  selected:    string[];
  onChange:    (v: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  }

  const label =
    selected.length === 0 ? placeholder :
    selected.length === 1 ? selected[0] :
    `${selected.length} 个地区`;

  const filtered = search
    ? options.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className={cn(
          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all',
          selected.length > 0
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300',
        )}
      >
        <MapPin size={11} />
        {label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-[160px] max-h-64 flex flex-col">
            <div className="flex items-center gap-1.5 px-2 py-1 mb-1 border-b border-gray-100">
              <Search size={10} className="text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索…"
                className="w-full text-xs bg-transparent outline-none placeholder:text-gray-300"
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {!search && (
                <button
                  onClick={() => { onChange([]); setOpen(false); }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-500 flex items-center gap-1.5"
                >
                  {selected.length === 0 && <Check size={10} className="text-blue-500" />}
                  {selected.length > 0   && <div className="w-[10px]" />}
                  全国
                </button>
              )}
              {filtered.map(v => (
                <button
                  key={v}
                  onClick={() => toggle(v)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 flex items-center gap-1.5"
                >
                  {selected.includes(v)
                    ? <Check size={10} className="text-blue-500 flex-shrink-0" />
                    : <div className="w-[10px] flex-shrink-0" />}
                  {v}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-[10px] text-gray-300 px-2 py-2">无匹配项</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Chart type helpers ─────────────────────────────────────────

const ADVANCED_TYPES = new Set<PersonaChartType>(['scatter', 'histogram', 'dumbbell', 'difference', 'heatmap']);

function getDefaultChartType(field: Field): PersonaChartType {
  return defaultPersonaChart(field);
}

// ── Per-card chart card ────────────────────────────────────────

function PersonaChartCard({
  field,
  filteredRecords,
  config,
  datasetId,
  initialChartType,
  chartSpec,
  dataset,
}: {
  field:             Field;
  filteredRecords:   Record<string, unknown>[];
  config:            ChartConfig;   // global config (from filter bar)
  datasetId:         string;
  initialChartType?: PersonaChartType;
  chartSpec?: PersonaChartSpec;
  dataset: Dataset;
}) {
  const { updateFieldOrdering } = useDatasetStore();
  const isRanking = field.type === 'ranking';

  // Ranking path: aggregateRanking; regular path: aggregateField
  const rankData = useMemo(
    () => isRanking ? aggregateRanking(filteredRecords, field) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredRecords, field, isRanking],
  );
  const data   = useMemo(
    () => isRanking ? [] : aggregateField(filteredRecords, field),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredRecords, field, isRanking],
  );
  const validN = isRanking
    ? (rankData?.N ?? 0)
    : data.reduce((s, d) => s + d.count, 0);

  const chartType = initialChartType ?? getDefaultChartType(field);
  // localCfg: null = follow global; non-null = card-level override
  const [localCfg, setLocalCfg] = useState<ChartConfig | null>(null);
  const effective = localCfg ?? config;
  const { height: cardH, onResizeStart, onResizeKeyDown, resetHeight } =
    useResizableChartHeight(effective.chartHeight);

  return (
    <div className="group relative select-none rounded-2xl bg-white p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800">{field.name}</h3>
            {isRanking && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-200 font-medium">
                排序题
              </span>
            )}
          </div>
          {effective.showSampleCount && (
            <p className="mt-0.5 text-xs text-gray-400">有效样本 n={validN.toLocaleString()}</p>
          )}
        </div>

        {/* Hover toolbar: chart type switcher + settings — hidden for ranking */}
        {!isRanking && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Per-card chart settings (includes field ordering) */}
            <ChartSettingsPanel
              config={effective}
              onChange={c => { setLocalCfg(c); resetHeight(); }}
              chartTypes={[chartType]}
              field={field}
              onUpdateOrdering={(isOrdered, orderedValues) =>
                updateFieldOrdering(datasetId, field.key, isOrdered, orderedValues)
              }
            />

            {/* Reset local override back to global config */}
            {localCfg && (
              <button
                onClick={() => { setLocalCfg(null); resetHeight(); }}
                title="恢复全局设置"
                className="text-[10px] text-gray-400 hover:text-blue-500 px-1 leading-none"
              >
                ↺
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chart — ranking uses heatmap engine; others use ChartRenderer */}
      {isRanking && rankData
        ? <RankingHeatmapEngine data={rankData} fieldName={field.name} />
        : ADVANCED_TYPES.has(chartType)
          ? <AdvancedPersonaChartEngine
              dataset={dataset}
              field={field}
              records={filteredRecords}
              baselineRecords={dataset.records}
              spec={{ ...chartSpec, type: chartType }}
              config={{ ...effective, chartHeight: cardH, showSampleCount: false }}
              height={cardH}
            />
        : (
          <ChartRenderer
            type={chartType as FlatChartType}
            data={data}
            config={{ ...effective, chartHeight: cardH, showSampleCount: false }}
            isMultiSelect={field.type === 'multi_choice'}
            totalSamples={filteredRecords.length}
            height={cardH}
          />
        )
      }

      {/* Resize handle — only for non-ranking cards */}
      {!isRanking && (
        <button
          type="button"
          onMouseDown={onResizeStart}
          onKeyDown={onResizeKeyDown}
          className="absolute bottom-1.5 left-1/2 flex h-4 w-16 -translate-x-1/2 cursor-ns-resize items-center justify-center opacity-40 transition-opacity hover:opacity-100 focus:opacity-100"
          aria-label="调整图表高度；使用上下方向键微调，Home 恢复默认"
        >
          <div className="w-10 h-1 bg-gray-200 rounded-full hover:bg-blue-300 transition-colors" />
        </button>
      )}
    </div>
  );
}

// ── PersonaView ───────────────────────────────────────────────

interface Props {
  dataset:    Dataset;
  viewConfig: ViewConfig;
}

const PERSONA_DEFAULT: ChartConfig = {
  ...DEFAULT_CHART_CONFIG,
  colorScheme: 'mckinsey',
  showLabel:   true,
  showXAxis:   false,
  showGrid:    false,
};

export function PersonaView({ dataset, viewConfig }: Props) {
  // ── All hooks MUST be declared before any conditional return ──
  const [geoLevel, setGeoLevel] = useUrlStringState<GeoLevel>(
    'filter_geo_level', 'all', ['all', 'region', 'province', 'city'],
  );
  const [selectedGeo, setSelectedGeo] = useUrlArrayState('filter_geo');
  const [selStatus, setSelStatus] = useUrlArrayState('filter_order', ['__all']);
  const [selMonths, setSelMonths] = useUrlArrayState('filter_time', ['__all']);
  const [globalConfig, handleConfigChange] =
    useStoredChartConfig('persona', PERSONA_DEFAULT);

  const statusOptions = useMemo(
    () => getStatusOptions(dataset.records, viewConfig),
    [dataset, viewConfig],
  );
  const timeField = useMemo(() => detectTimeField(dataset), [dataset]);
  const dateBlocks = useMemo(
    () => viewConfig.dateBlocks?.length ? viewConfig.dateBlocks : getDefaultDateBlocks(dataset, timeField),
    [dataset, timeField, viewConfig.dateBlocks],
  );
  const monthOptions = useMemo(() => dateBlocks.map(block => block.key), [dateBlocks]);
  const monthLabels = useMemo(() => Object.fromEntries(dateBlocks.map(block => [block.key, block.label])), [dateBlocks]);
  const filteredRecords = useMemo(
    () => filterByDateBlocks(
      filterRecords(dataset.records, viewConfig, geoLevel, selectedGeo, selStatus),
      timeField,
      selMonths,
      dateBlocks,
    ),
    [dataset.records, viewConfig, geoLevel, selectedGeo, selStatus, timeField, selMonths, dateBlocks],
  );
  const personaFields = useMemo(
    () => (viewConfig.personaFieldKeys ?? [])
        .map(k => dataset.fields.find(f => f.key === k))
        .filter((field): field is Field => !!field && field.key !== timeField?.key),
    [dataset.fields, viewConfig.personaFieldKeys, timeField],
  );
  const geoLabel =
    selectedGeo.length === 0 ? '全国' :
    selectedGeo.length === 1 ? selectedGeo[0] :
    `${selectedGeo.length} 个地区`;

  const geoLevels = ([
    { key: 'region'   as GeoLevel, label: '大区', fieldKey: viewConfig.geoRegionKey   },
    { key: 'province' as GeoLevel, label: '省份', fieldKey: viewConfig.geoProvinceKey },
    { key: 'city'     as GeoLevel, label: '城市', fieldKey: viewConfig.geoCityKey     },
  ] as const).filter(l => l.fieldKey);

  const changeGeoLevel = (lv: GeoLevel) => { setGeoLevel(lv); setSelectedGeo([]); };

  return (
    <div className="space-y-4">

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl bg-white px-5 py-4">

        {/* Row 1: Geo filter + chart settings + view toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <GeoFilterGroup
            dataset={dataset}
            viewConfig={viewConfig}
            level={geoLevel}
            selected={selectedGeo}
            onLevelChange={setGeoLevel}
            onChange={setSelectedGeo}
          />

          {/* Right-side controls */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-gray-500">
              <span className="text-gray-400">{geoLabel}</span>
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="font-semibold text-gray-700">
                {filteredRecords.length.toLocaleString()}
              </span>
              <span className="text-gray-400 ml-1">个样本</span>
            </span>

            <div className="w-px h-4 bg-gray-200" />

            {/* Global chart settings */}
            <ChartSettingsPanel
              config={globalConfig}
              onChange={handleConfigChange}
              chartTypes={[...new Set(personaFields.map(field =>
                viewConfig.personaCharts?.[field.key]?.type ?? getDefaultChartType(field)
              ))]}
              allowPartial
            />
          </div>
        </div>

        <StatusFilterGroups
          datasetId={dataset.id}
          viewConfig={viewConfig}
          onStatusVariableChange={() => setSelStatus(['__all'])}
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

      {/* ── Chart grid ─────────────────────────────────────── */}
      {personaFields.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          暂无配置的人口维度字段。请在数据中心的字段概览中配置字段后返回。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {personaFields.map(field => (
            <PersonaChartCard key={field.key} field={field} filteredRecords={filteredRecords}
              config={globalConfig} datasetId={dataset.id} dataset={dataset}
              chartSpec={viewConfig.personaCharts?.[field.key]}
              initialChartType={viewConfig.personaCharts?.[field.key]?.type} />
          ))}
        </div>
      )}
    </div>
  );
}
