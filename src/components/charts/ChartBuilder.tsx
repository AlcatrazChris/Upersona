'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  BarChart2, PieChart, TrendingUp, Activity, Circle,
  CalendarDays, Bookmark, BookmarkCheck, MousePointerClick, Layers, X, CircleDot, Grid3X3,
} from 'lucide-react';
import { ChartCard } from './ChartCard';
import { ChartContainer } from './ChartContainer';
import { ChartSettingsPanel, useStoredChartConfig } from './ChartSettingsPanel';
import { ComparePanel } from './ComparePanel';
import { GroupChartRenderer } from './engine/ChartRenderer';
import { RankingHeatmapEngine } from './engine/RankingHeatmapEngine';
import { useDatasetStore } from '@/store/datasetStore';
import { aggregateField, aggregateFieldGrouped, aggregateRanking, inferDateGran } from '@/lib/dataAggregator';
import type { RankingData } from '@/lib/dataAggregator';
import { cn } from '@/lib/utils';
import type { Dataset, Field, FieldType } from '@/types/dataSchema';
import type { ChartType } from '@/components/charts/engine/types';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ChartSchema } from '@/types/chartSchema';
import { detectTimeField } from '@/lib/timeStatus';

// ── Constants ─────────────────────────────────────────────────

const TYPE_COLORS: Record<FieldType, string> = {
  single_choice: 'bg-blue-50 text-blue-600',
  multi_choice:  'bg-purple-50 text-purple-600',
  ranking:       'bg-indigo-50 text-indigo-600',
  number:        'bg-green-50 text-green-600',
  date:          'bg-orange-50 text-orange-600',
  boolean:       'bg-red-50 text-red-600',
  text:          'bg-gray-100 text-gray-400',
};

const TYPE_LABELS: Record<FieldType, string> = {
  single_choice: '单选', multi_choice: '多选', ranking: '排序',
  number: '数值', date: '日期', boolean: '布尔', text: '文本',
};

type NormalType = 'bar' | 'lollipop' | 'waffle' | 'pie' | 'donut' | 'line' | 'area';
const NORMAL_TYPES: NormalType[] = ['bar', 'lollipop', 'waffle', 'pie', 'donut', 'line', 'area'];

const CHART_ICONS: Record<NormalType, React.ReactNode> = {
  bar:   <BarChart2  size={13} />,
  pie:   <PieChart   size={13} />,
  donut: <Circle     size={13} />,
  line:  <TrendingUp size={13} />,
  area:  <Activity   size={13} />,
  lollipop: <CircleDot size={13} />,
  waffle: <Grid3X3 size={13} />,
};

const CHART_LABELS: Record<NormalType, string> = {
  bar: '条形图', lollipop: '棒棒糖图', waffle: '华夫图',
  pie: '饼图', donut: '环形图', line: '折线图', area: '面积图',
};

const DATE_GRAN_LABELS = { year: '按年', month: '按月', day: '按日' } as const;
type DateGran = keyof typeof DATE_GRAN_LABELS;

// ── Helpers ───────────────────────────────────────────────────

function getSupportedTypes(field: Field): NormalType[] {
  const recs = field.recommendedCharts as string[];
  const filtered = recs.filter((t): t is NormalType => NORMAL_TYPES.includes(t as NormalType));
  if (field.type === 'single_choice' || field.type === 'boolean') {
    return [...new Set<NormalType>([...filtered, 'lollipop', 'waffle'])];
  }
  if (field.type === 'multi_choice') {
    return [...new Set<NormalType>([...filtered, 'lollipop'])];
  }
  return filtered.length > 0 ? filtered : ['bar'];
}

function isChartable(f: Field): boolean {
  return f.type !== 'text';
}

// ── Component ─────────────────────────────────────────────────

export function ChartBuilder({ dataset }: { dataset: Dataset }) {
  const timeField = detectTimeField(dataset);
  const defaultField = dataset.fields.find(field => isChartable(field) && field.key !== timeField?.key) ?? null;

  const [activeKey,  setActiveKey]  = useState<string | null>(defaultField?.key ?? null);
  const [chartType,  setChartType]  = useState<NormalType>(() =>
    defaultField ? getSupportedTypes(defaultField)[0] : 'bar'
  );
  const [config, handleConfigChange] = useStoredChartConfig('builder');
  const [dateGran,   setDateGran]   = useState<DateGran>('month');
  const [chartTitle, setChartTitle] = useState<string>(() => defaultField?.name ?? '');
  const [justSaved,  setJustSaved]  = useState(false);

  // Compare mode state
  const [compareMode,    setCompareMode]    = useState(false);
  const [compareType,    setCompareType]    = useState<'grouped' | 'stacked'>('grouped');
  const [groupFieldKey,  setGroupFieldKey]  = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const saveChart          = useDatasetStore(s => s.saveChart);
  const updateFieldOrdering = useDatasetStore(s => s.updateFieldOrdering);

  const activeField = useMemo(
    () => dataset.fields.find(f => f.key === activeKey) ?? null,
    [dataset.fields, activeKey],
  );

  const availableTypes = useMemo(
    () => activeField ? getSupportedTypes(activeField) : ['bar' as NormalType],
    [activeField],
  );

  const selectField = useCallback((field: Field) => {
    setActiveKey(field.key);
    setChartTitle(field.name);
    const types = getSupportedTypes(field);
    if (!types.includes(chartType)) setChartType(types[0]);
    if (field.type === 'date') setDateGran(inferDateGran(dataset.records, field.key));
    // Reset compare group if group field = new main field
    if (groupFieldKey === field.key) { setGroupFieldKey(null); setSelectedGroups([]); }
  }, [chartType, dataset.records, groupFieldKey]);

  // ── Ranking field ─────────────────────────────────────────────
  const isRankingField = activeField?.type === 'ranking';

  const rankingData = useMemo<RankingData | null>(() => {
    if (!activeField || activeField.type !== 'ranking') return null;
    return aggregateRanking(dataset.records, activeField);
  }, [dataset.records, activeField]);

  const chartData = useMemo(() => {
    if (!activeField || compareMode || isRankingField) return [];
    return aggregateField(
      dataset.records, activeField,
      activeField.type === 'date' ? dateGran : 'month',
    );
  }, [dataset.records, activeField, dateGran, compareMode, isRankingField]);

  const groupedData = useMemo(() => {
    if (!compareMode || !activeField || !groupFieldKey || selectedGroups.length < 2) return null;
    const gf = dataset.fields.find(f => f.key === groupFieldKey);
    if (!gf) return null;
    return aggregateFieldGrouped(dataset.records, activeField, gf, selectedGroups);
  }, [compareMode, activeField, groupFieldKey, selectedGroups, dataset.records, dataset.fields]);

  function toggleCompare() {
    setCompareMode(v => !v);
    if (!compareMode) {
      // entering compare — reset group state
      setGroupFieldKey(null);
      setSelectedGroups([]);
    }
  }

  function handleGroupFieldChange(key: string | null, autoSelected: string[]) {
    setGroupFieldKey(key);
    setSelectedGroups(autoSelected);
  }

  function handleSave() {
    if (!activeField) return;
    const finalType: ChartType = isRankingField
      ? 'ranking-heatmap'
      : compareMode
        ? (compareType === 'stacked' ? 'stacked-bar' : 'grouped-bar')
        : chartType;
    saveChart(dataset.id, {
      fieldKey:      activeField.key,
      chartType:     finalType,
      title:         chartTitle || activeField.name,
      config,
      groupFieldKey:  (!isRankingField && compareMode && groupFieldKey) ? groupFieldKey : undefined,
      selectedGroups: (!isRankingField && compareMode && selectedGroups.length) ? selectedGroups : undefined,
      dateGranularity: activeField.type === 'date' ? dateGran : undefined,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  const chartableFields = dataset.fields.filter(
    field => isChartable(field) && field.key !== timeField?.key,
  );
  const textFieldCount  = dataset.fields.length - chartableFields.length;
  const validSamples    = chartData.reduce((s, d) => s + d.count, 0);
  const canSave = isRankingField
    ? (rankingData?.N ?? 0) > 0
    : compareMode
      ? !!(groupedData)
      : chartData.length > 0;

  const previewSchema = useMemo<ChartSchema | null>(() => {
    if (!activeField) return null;
    const type: ChartType = isRankingField
      ? 'ranking-heatmap'
      : compareMode
        ? (compareType === 'stacked' ? 'stacked-bar' : 'grouped-bar')
        : chartType;
    return {
      version: 1,
      id: 'chart-preview',
      presentation: { title: chartTitle || activeField.name },
      data: {
        datasetId: dataset.id,
        fieldKey: activeField.key,
        groupFieldKey: groupFieldKey ?? undefined,
        selectedGroups: selectedGroups.length ? selectedGroups : undefined,
        dateGranularity: activeField.type === 'date' ? dateGran : undefined,
        aggregation: 'count',
      },
      chart: { type },
      appearance: config,
      layout: { height: config.chartHeight },
    };
  }, [activeField, chartTitle, chartType, compareMode, compareType, config, dataset.id, dateGran, groupFieldKey, isRankingField, selectedGroups]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* ── Left: field selector ─────────────────────────────── */}
      <div className="md:col-span-1">
        <div className="text-xs font-semibold text-gray-400 px-1 mb-2 uppercase tracking-wide">
          选择字段
        </div>
        <div className="space-y-0.5">
          {chartableFields.map(f => {
            const isActive = activeKey === f.key;
            return (
              <button
                key={f.key}
                onClick={() => selectField(f)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all',
                  isActive
                    ? 'bg-blue-50 border border-blue-200 shadow-sm'
                    : 'hover:bg-gray-50 border border-transparent',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'text-sm font-medium truncate transition-colors',
                      isActive ? 'text-blue-600' : 'text-gray-700',
                    )}>
                      {f.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0',
                      TYPE_COLORS[f.type],
                    )}>
                      {TYPE_LABELS[f.type]}
                    </span>
                    {f.statistics && (
                      <span className="text-[10px] text-gray-400 tabular-nums">
                        {f.statistics.unique} 唯一值
                      </span>
                    )}
                  </div>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
              </button>
            );
          })}

          {textFieldCount > 0 && (
            <div className="px-3 py-2 text-[10px] text-gray-400 flex items-center gap-1.5">
              <span className="flex-1 h-px bg-gray-100 rounded" />
              {textFieldCount} 个文本字段不支持图表
              <span className="flex-1 h-px bg-gray-100 rounded" />
            </div>
          )}
        </div>
      </div>

      {/* ── Right: chart preview ──────────────────────────────── */}
      <div className="md:col-span-3 space-y-3">
        {activeField ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {isRankingField ? (
                // Ranking field: fixed heatmap indicator
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-medium border border-indigo-200">
                  排序热力图
                </div>
              ) : compareMode ? (
                // Compare mode: show 簇状 / 堆积 buttons
                <>
                  {(['grouped', 'stacked'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setCompareType(t)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                        compareType === t
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
                      )}
                    >
                      {t === 'grouped' ? '簇状' : '堆积'}
                    </button>
                  ))}
                </>
              ) : (
                // Normal mode: chart type buttons
                availableTypes.map(t => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                      chartType === t
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
                    )}
                  >
                    {CHART_ICONS[t]}
                    {CHART_LABELS[t]}
                  </button>
                ))
              )}

              {/* Date granularity (normal mode, date field only) */}
              {!isRankingField && !compareMode && activeField.type === 'date' && (
                <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
                  {(Object.keys(DATE_GRAN_LABELS) as DateGran[]).map(g => (
                    <button
                      key={g}
                      onClick={() => setDateGran(g)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                        dateGran === g ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600',
                      )}
                    >
                      {DATE_GRAN_LABELS[g]}
                    </button>
                  ))}
                </div>
              )}

              {/* Settings panel — not for ranking */}
              {!isRankingField && (
                <ChartSettingsPanel
                  config={config}
                  onChange={handleConfigChange}
                  chartTypes={[chartType]}
                  field={activeField}
                  onUpdateOrdering={(isOrdered, orderedValues) =>
                    updateFieldOrdering(dataset.id, activeField.key, isOrdered, orderedValues)
                  }
                  className={compareMode || activeField.type !== 'date' ? 'ml-auto' : ''}
                />
              )}

              {/* Compare toggle — not for ranking */}
              {!isRankingField && (
                <button
                  onClick={toggleCompare}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                    isRankingField ? 'hidden' : '',
                    compareMode
                      ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600',
                  )}
                >
                  {compareMode ? <><X size={12} />退出对比</> : <><Layers size={12} />对比</>}
                </button>
              )}
            </div>

            {/* Compare panel */}
            {compareMode && (
              <ComparePanel
                dataset={dataset}
                mainFieldKey={activeKey}
                groupFieldKey={groupFieldKey}
                selectedGroups={selectedGroups}
                onGroupFieldChange={handleGroupFieldChange}
                onSelectedGroupsChange={setSelectedGroups}
              />
            )}

            {/* Title input */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 flex-shrink-0">图表标题</label>
              <input
                value={chartTitle}
                onChange={e => setChartTitle(e.target.value)}
                placeholder={activeField.name}
                className="flex-1 text-sm px-3 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                maxLength={60}
              />
            </div>

            {/* Chart preview */}
            {previewSchema ? (
              <ChartContainer schema={previewSchema} dataset={dataset} className="border border-gray-100" />
            ) : isRankingField ? (
              rankingData && rankingData.N > 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-gray-800 truncate flex-1">
                      {chartTitle || activeField.name}
                    </span>
                    <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      排序题 · {rankingData.rows.length} 个选项 · n={rankingData.N}
                    </span>
                  </div>
                  <RankingHeatmapEngine
                    data={rankingData}
                    fieldName={chartTitle || activeField.name}
                    height={config.chartHeight}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                  <div className="text-sm text-gray-400">该排序字段无可聚合数据</div>
                  <div className="text-xs text-gray-300 mt-1">请检查字段值中是否包含 → 分隔符</div>
                </div>
              )
            ) : compareMode ? (
              groupedData ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-gray-800 truncate flex-1">
                      {chartTitle || activeField.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {compareType === 'grouped' ? '簇状对比' : '堆积对比'}
                    </span>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: Math.max(config.chartHeight * 1.5, 480) }}>
                    <GroupChartRenderer
                      type={compareType}
                      data={groupedData}
                      config={config}
                      height={config.chartHeight}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                  <Layers size={28} className="mx-auto mb-2 text-gray-200" />
                  <div className="text-sm text-gray-400">
                    {groupFieldKey ? '请选择至少 2 个对比值' : '请选择分组字段'}
                  </div>
                </div>
              )
            ) : chartData.length > 0 ? (
              <ChartCard
                title={chartTitle || activeField.name}
                data={chartData}
                config={config}
                chartType={chartType}
                chartHeight={config.chartHeight}
                isMultiSelect={activeField.type === 'multi_choice'}
                totalSamples={dataset.rowCount}
                validSamples={validSamples}
                onTitleChange={setChartTitle}
                className="border border-gray-100"
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="text-sm text-gray-400">该字段无可聚合数据</div>
                <div className="text-xs text-gray-300 mt-1">请检查字段值是否为空</div>
              </div>
            )}

            {/* Footer: summary + save */}
            {canSave && (
              <div className="flex items-center gap-4 px-1">
                {isRankingField ? (
                  rankingData && (
                    <>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MousePointerClick size={10} />
                        {rankingData.rows.length} 个选项
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <BarChart2 size={10} />
                        {rankingData.N.toLocaleString()} / {dataset.rowCount.toLocaleString()} 份有效数据
                      </span>
                    </>
                  )
                ) : compareMode ? (
                  groupedData && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <BarChart2 size={10} />
                      {selectedGroups.length} 组 · {groupedData.seriesKeys.length} 个维度值
                    </span>
                  )
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <MousePointerClick size={10} />
                      {chartData.length} 个分类
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <BarChart2 size={10} />
                      {validSamples.toLocaleString()} / {dataset.rowCount.toLocaleString()} 行
                    </span>
                    {activeField.type === 'date' && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <CalendarDays size={10} />
                        {DATE_GRAN_LABELS[dateGran]}
                      </span>
                    )}
                  </>
                )}

                <button
                  onClick={handleSave}
                  disabled={justSaved}
                  className={cn(
                    'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                    justSaved
                      ? 'bg-green-50 text-green-600 cursor-default'
                      : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600',
                  )}
                >
                  {justSaved
                    ? <><BookmarkCheck size={13} />已保存</>
                    : <><Bookmark size={13} />保存到面板</>
                  }
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <BarChart2 size={32} className="mx-auto mb-3 text-gray-200" />
            <div className="text-sm font-medium text-gray-400 mb-1">选择一个字段开始</div>
            <div className="text-xs text-gray-300">支持单选、多选、数值、日期、布尔类型</div>
          </div>
        )}
      </div>
    </div>
  );
}
