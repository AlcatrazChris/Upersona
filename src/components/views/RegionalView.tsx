'use client';

import { useState, useMemo, useEffect } from 'react';
import { MapPin, Plus, X, ChevronDown } from 'lucide-react';
import { aggregateFieldGrouped } from '@/lib/dataAggregator';
import { filterRecords, getGeoOptions, getStatusOptions, type GeoLevel } from '@/lib/filterRecords';
import { GroupChartRenderer } from '@/components/charts/engine/ChartRenderer';
import { ChartTypeSwitcher, useResizableChartHeight } from '@/components/charts/engine/shared';
import { ChartSettingsPanel, useStoredChartConfig } from '@/components/charts/ChartSettingsPanel';
import { AIInsightPanel }        from '@/components/shared/AIInsightPanel';
import { DEFAULT_CHART_CONFIG, type ChartConfig } from '@/lib/chartConfig';
import { cn } from '@/lib/utils';
import { useDatasetStore } from '@/store/datasetStore';
import type { Dataset } from '@/types/dataSchema';
import type { ViewConfig } from '@/lib/viewConfig';
import { StatusFilterGroups } from '@/components/shared/StatusFilterGroups';
import { GeoFilterGroup } from '@/components/shared/GeoFilterGroup';
import { detectTimeField, filterByDateBlocks, getDefaultDateBlocks } from '@/lib/timeStatus';
import { useUrlArrayState, useUrlStringState } from '@/hooks/useUrlParamState';

// ── Region chip ────────────────────────────────────────────────

function RegionChip({ value, onRemove }: { value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 pl-3 pr-2 py-1 rounded-full">
      {value}
      <button onClick={onRemove} className="hover:text-blue-900">
        <X size={10} />
      </button>
    </span>
  );
}

// ── Add region dropdown ────────────────────────────────────────

function AddRegionDropdown({
  options, selected, onAdd,
}: {
  options: string[];
  selected: string[];
  onAdd: (v: string) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');

  const remaining = options.filter(
    o => !selected.includes(o) && o.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 transition-all"
      >
        <Plus size={10} />
        添加地区
        <ChevronDown size={9} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-40">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索…"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 mb-1.5 outline-none"
            />
            <div className="max-h-44 overflow-y-auto space-y-0.5">
              {remaining.map(v => (
                <button
                  key={v}
                  onClick={() => { onAdd(v); setSearch(''); /* 不关闭，支持继续多选 */ }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-blue-50 text-gray-700"
                >
                  {v}
                </button>
              ))}
              {remaining.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">无更多选项</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Chart card ─────────────────────────────────────────────────

type ChartMode = 'stacked' | 'grouped';

interface RegionalChartCardProps {
  title:        string;
  subtitle?:    string;
  mode:         ChartMode;
  onModeChange: (m: ChartMode) => void;
  config:       ChartConfig;
  children: (cfg: { config: ChartConfig; chartH: number }) => React.ReactNode;
}

function RegionalChartCard({
  title, subtitle, mode, onModeChange, config, children,
}: RegionalChartCardProps) {
  const { height: chartH, onResizeStart, onResizeKeyDown } =
    useResizableChartHeight(config.chartHeight, 200);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 relative group select-none">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {/* Chart mode toggle */}
          <ChartTypeSwitcher
            value={mode}
            options={['stacked', 'grouped'] as const}
            onChange={onModeChange}
          />
        </div>
      </div>

      {/* Chart content */}
      {children({ config, chartH })}

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

// ── RegionalView ───────────────────────────────────────────────

interface Props {
  dataset:    Dataset;
  viewConfig: ViewConfig;
}

export function RegionalView({ dataset, viewConfig }: Props) {
  const [geoLevel, setGeoLevel] = useUrlStringState<GeoLevel>(
    'filter_geo_level', 'region', ['region', 'province', 'city'],
  );
  const [selectedGeo, setSelectedGeo] = useUrlArrayState('filter_geo');
  const { updateViewConfig, personaConfigs, activePersonaConfigId } = useDatasetStore();
  const [selStatus, setSelStatus] = useUrlArrayState('filter_order', ['__all']);
  const [selMonths, setSelMonths] = useUrlArrayState('filter_time', ['__all']);
  const [dimOpen,      setDimOpen]      = useState(false);
  const [chartMode, setChartMode] = useUrlStringState<ChartMode>(
    'regional_chart', 'stacked', ['stacked', 'grouped'],
  );
  const [globalConfig, handleConfigChange] =
    useStoredChartConfig('regional', DEFAULT_CHART_CONFIG);

  const activeConfig = (personaConfigs[dataset.id] ?? []).find(c => c.id === activePersonaConfigId);
  const timeField = useMemo(() => detectTimeField(dataset), [dataset]);

  const firstFieldKey = activeConfig
    ? (activeConfig.blocks.find(b => b.visible && b.sourceFieldKey)?.sourceFieldKey ?? viewConfig.personaFieldKeys?.[0] ?? '')
    : (viewConfig.personaFieldKeys?.[0] ?? '');
  const [dimKey, setDimKey] = useState<string>(firstFieldKey);

  const geoLevels = ([
    { key: 'region'   as GeoLevel, label: '大区', fieldKey: viewConfig.geoRegionKey   },
    { key: 'province' as GeoLevel, label: '省份', fieldKey: viewConfig.geoProvinceKey },
    { key: 'city'     as GeoLevel, label: '城市', fieldKey: viewConfig.geoCityKey     },
  ] as const).filter(l => l.fieldKey);

  const statusOptions = useMemo(() => getStatusOptions(dataset.records, viewConfig), [dataset, viewConfig]);
  const dateBlocks = useMemo(
    () => viewConfig.dateBlocks?.length ? viewConfig.dateBlocks : getDefaultDateBlocks(dataset, timeField),
    [dataset, timeField, viewConfig.dateBlocks],
  );
  const monthOptions = useMemo(() => dateBlocks.map(block => block.key), [dateBlocks]);
  const monthLabels = useMemo(() => Object.fromEntries(dateBlocks.map(block => [block.key, block.label])), [dateBlocks]);

  const statusFiltered = useMemo(
    () => filterByDateBlocks(
      filterRecords(dataset.records, viewConfig, 'all', [], selStatus),
      timeField,
      selMonths,
      dateBlocks,
    ),
    [dataset.records, viewConfig, selStatus, timeField, selMonths, dateBlocks],
  );

  const dimensionField = dataset.fields.find(f => f.key === dimKey);
  const geoField = dataset.fields.find(f => {
    const key =
      geoLevel === 'region'   ? viewConfig.geoRegionKey :
      geoLevel === 'province' ? viewConfig.geoProvinceKey :
      viewConfig.geoCityKey;
    return f.key === key;
  });

  const personaFields = useMemo(() => {
    if (activeConfig) {
      return activeConfig.blocks
        .filter(b => b.visible && b.sourceFieldKey)
        .map(b => dataset.fields.find(f => f.key === b.sourceFieldKey))
        .filter((field): field is NonNullable<typeof field> => !!field && field.key !== timeField?.key);
    }
    return (viewConfig.personaFieldKeys ?? [])
      .map(k => dataset.fields.find(f => f.key === k))
      .filter((field): field is NonNullable<typeof field> => !!field && field.key !== timeField?.key);
  }, [dataset.fields, viewConfig.personaFieldKeys, activeConfig, timeField]);

  useEffect(() => {
    if (timeField?.key === dimKey || !personaFields.some(field => field.key === dimKey)) {
      setDimKey(personaFields[0]?.key ?? '');
    }
  }, [dimKey, personaFields, timeField]);

  const groupedData = useMemo(() => {
    if (!dimensionField || !geoField || selectedGeo.length === 0) return null;
    return aggregateFieldGrouped(statusFiltered, dimensionField, geoField, selectedGeo);
  }, [statusFiltered, dimensionField, geoField, selectedGeo]);

  const handleLevelChange = (lv: GeoLevel) => { setGeoLevel(lv); setSelectedGeo([]); };

  // AI insight helpers
  const insightCacheKey = `regional_${geoLevel}_${selectedGeo.join(',')}_${dimKey}_${selStatus.join(',')}_${selMonths.join(',')}`;
  const insightLabel = selectedGeo.length === 0
    ? '（请先选择地区）'
    : `${selectedGeo.join(' vs ')} · ${dimensionField?.name ?? ''}`;

  const REGIONAL_DEFAULT_PROMPT = `分析上方数据，输出地区差异洞察。禁止开场白、总结段落、套话。

## 核心差异（≤3条）
格式：[地区]的[维度]【XX%】vs均值【XX%】——[一句判断]

## 成因与启示（≤3条）
格式：[地区]·[判断]——[一句行动建议]

只引用上方真实数据，每条≤40字，不输出其他任何内容。`;

  function buildRegionalContext() {
    return {
      analysisType: 'regional_comparison',
      dataset:      dataset.name,
      dimension:    dimensionField?.name ?? dimKey,
      regions:      selectedGeo,
      totalSamples: statusFiltered.length,
      distribution: groupedData?.items.slice(0, 20).map(item => ({
        value: String(item.label),
        ...Object.fromEntries(selectedGeo.map(r => [r, item[r] ?? 0])),
      })) ?? [],
      unit: '%（占该地区总样本）',
    };
  }

  return (
    <div className="space-y-4">

      {/* ── Filter bar ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">

        {/* Row 1: Geo level + dimension picker + chart settings */}
        <div className="flex items-center gap-2 flex-wrap">
          <GeoFilterGroup
            dataset={dataset}
            viewConfig={viewConfig}
            level={geoLevel}
            selected={selectedGeo}
            onLevelChange={setGeoLevel}
            onChange={setSelectedGeo}
            allowAll={false}
          />

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {/* Dimension picker */}
          <div className="relative">
            <button
              onClick={() => setDimOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:border-blue-300 transition-all"
            >
              对比维度：{dimensionField?.name ?? '选择'}
              <ChevronDown size={10} />
            </button>
            {dimOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDimOpen(false)} />
                <div className="absolute z-50 top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-44 max-h-52 overflow-y-auto">
                  {personaFields.map(f => (
                    <button
                      key={f.key}
                      onClick={() => { setDimKey(f.key); setDimOpen(false); }}
                      className={cn(
                        'w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50',
                        f.key === dimKey ? 'text-blue-600 font-medium' : 'text-gray-700',
                      )}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Chart settings — global */}
          <div className="ml-auto">
            <ChartSettingsPanel
              config={globalConfig}
              onChange={handleConfigChange}
              chartTypes={['grouped']}
            />
          </div>
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

      {/* ── AI Insight ───────────────────────────────── */}
      {dimensionField && geoField && selectedGeo.length > 0 && (
        <AIInsightPanel
          label={insightLabel}
          cacheKey={insightCacheKey}
          cachedResult={viewConfig.insightResults?.[insightCacheKey]}
          onCache={(key, result) =>
            updateViewConfig(dataset.id, {
              insightResults: { ...(viewConfig.insightResults ?? {}), [key]: result },
            })
          }
          defaultPrompt={REGIONAL_DEFAULT_PROMPT}
          savedPrompt={viewConfig.viewPrompts?.['regional']}
          onPromptSave={p =>
            updateViewConfig(dataset.id, {
              viewPrompts: { ...(viewConfig.viewPrompts ?? {}), regional: p },
            })
          }
          buildContext={buildRegionalContext}
        />
      )}

      {/* ── Chart ────────────────────────────────────── */}
      {!dimensionField || !geoField ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          请先在数据中心配置地理字段，并选择对比维度
        </div>
      ) : selectedGeo.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          请在上方选择要对比的{geoLevels.find(l => l.key === geoLevel)?.label ?? '地区'}
        </div>
      ) : !groupedData ? null : (
        <RegionalChartCard
          title={`${dimensionField.name} 分布对比`}
          subtitle={`${selectedGeo.join(' · ')}${!selStatus.includes('__all') ? ` · ${selStatus.join('/')}` : ''}`}
          mode={chartMode}
          onModeChange={setChartMode}
          config={globalConfig}
        >
          {({ config, chartH }) => {
            const cfg = { ...config, showSampleCount: true, chartHeight: chartH };
            return (
              <GroupChartRenderer
                type={chartMode}
                data={groupedData}
                config={cfg}
                height={chartH}
              />
            );
          }}
        </RegionalChartCard>
      )}
    </div>
  );
}
