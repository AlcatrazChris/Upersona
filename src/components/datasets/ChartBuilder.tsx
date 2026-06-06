'use client';

/**
 * ChartBuilder
 *
 * 数据集的交互式图表构建器：
 *  - 左：字段选择器（单选 / 多选 / 数值 / 日期 / 布尔）
 *  - 中：图表类型切换（基于 recommendedCharts 过滤，仅显示引擎支持的类型）
 *  - 右：实时 ChartCard 预览，支持配置面板 & PNG/SVG 导出
 *
 * 日期字段额外提供粒度切换（年 / 月 / 日）。
 */

import { useState, useMemo, useCallback } from 'react';
import {
  BarChart2, PieChart, TrendingUp, Activity,
  Circle, MousePointerClick, CalendarDays, Bookmark, BookmarkCheck,
} from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { useDatasetStore } from '@/store/datasetStore';
import { aggregateField, inferDateGran } from '@/lib/dataAggregator';
import { loadChartConfig, saveChartConfig } from '@/lib/chartConfig';
import { cn } from '@/lib/utils';
import type { Dataset, Field, FieldType } from '@/types/dataSchema';
import type { ChartType } from '@/components/charts/engine/types';
import type { ChartConfig } from '@/lib/chartConfig';

// ── 常量 ──────────────────────────────────────────────────────

const TYPE_COLORS: Record<FieldType, string> = {
  single_choice: 'bg-[#007AFF]/10 text-[#007AFF]',
  multi_choice:  'bg-[#5856D6]/10 text-[#5856D6]',
  number:        'bg-[#34C759]/10 text-[#34C759]',
  date:          'bg-[#FF9500]/10 text-[#FF9500]',
  boolean:       'bg-[#FF2D55]/10 text-[#FF2D55]',
  text:          'bg-black/06 text-black/40',
};

const TYPE_LABELS: Record<FieldType, string> = {
  single_choice: '单选',
  multi_choice:  '多选',
  number:        '数值',
  date:          '日期',
  boolean:       '布尔',
  text:          '文本',
};

// 引擎支持的图表类型（过滤掉 scatter / heatmap / wordcloud / table）
type SupportedType = ChartType; // 'bar' | 'pie' | 'donut' | 'line' | 'area'
const SUPPORTED_TYPES: SupportedType[] = ['bar', 'pie', 'donut', 'line', 'area'];

const CHART_ICONS: Record<SupportedType, React.ReactNode> = {
  bar:   <BarChart2 size={13} />,
  pie:   <PieChart  size={13} />,
  donut: <Circle    size={13} />,
  line:  <TrendingUp size={13} />,
  area:  <Activity  size={13} />,
};

const CHART_LABELS: Record<SupportedType, string> = {
  bar:   '条形图',
  pie:   '饼图',
  donut: '环形图',
  line:  '折线图',
  area:  '面积图',
};

// 日期粒度
const DATE_GRAN_LABELS = { year: '按年', month: '按月', day: '按日' } as const;
type DateGran = keyof typeof DATE_GRAN_LABELS;

// ── 工具 ──────────────────────────────────────────────────────

/** 从 recommendedCharts 中过滤出引擎支持的图表类型 */
function getSupportedTypes(field: Field): SupportedType[] {
  const recs = field.recommendedCharts as string[];
  const filtered = recs.filter((t): t is SupportedType => SUPPORTED_TYPES.includes(t as SupportedType));
  // 保证至少有 bar
  return filtered.length > 0 ? filtered : ['bar'];
}

/** 是否可以显示图表（文本字段跳过） */
function isChartable(f: Field): boolean {
  return f.type !== 'text';
}

// ── 主组件 ────────────────────────────────────────────────────

interface ChartBuilderProps {
  dataset: Dataset;
}

export function ChartBuilder({ dataset }: ChartBuilderProps) {
  // 默认选中第一个可图表字段
  const defaultField = dataset.fields.find(isChartable) ?? null;

  const [activeKey, setActiveKey] = useState<string | null>(defaultField?.key ?? null);
  const [chartType, setChartType] = useState<SupportedType>(() => {
    if (!defaultField) return 'bar';
    return getSupportedTypes(defaultField)[0];
  });
  const [config, setConfig]   = useState<ChartConfig>(() => loadChartConfig('datasets'));
  const [dateGran, setDateGran] = useState<DateGran>('month');
  const [justSaved, setJustSaved] = useState(false);

  const saveChart = useDatasetStore(s => s.saveChart);

  // ── 当前激活字段 ─────────────────────────────────────────
  const activeField = useMemo(
    () => dataset.fields.find(f => f.key === activeKey) ?? null,
    [dataset.fields, activeKey],
  );

  const availableTypes = useMemo(
    () => activeField ? getSupportedTypes(activeField) : ['bar' as SupportedType],
    [activeField],
  );

  // ── 选择字段 ─────────────────────────────────────────────
  const selectField = useCallback((field: Field) => {
    setActiveKey(field.key);
    const types = getSupportedTypes(field);
    // 若当前图表类型该字段不支持，切换到该字段的首选
    if (!types.includes(chartType)) setChartType(types[0]);
    // 日期字段：自动推断粒度
    if (field.type === 'date') {
      setDateGran(inferDateGran(dataset.records, field.key));
    }
  }, [chartType, dataset.records]);

  // ── 聚合数据（只在字段/粒度/records 变化时重算） ────────
  const chartData = useMemo(() => {
    if (!activeField) return [];
    return aggregateField(
      dataset.records,
      activeField,
      activeField.type === 'date' ? dateGran : 'month',
    );
  }, [dataset.records, activeField, dateGran]);

  const handleConfigChange = useCallback((c: ChartConfig) => {
    setConfig(c);
    saveChartConfig('datasets', c);
  }, []);

  function handleSaveChart(title: string) {
    if (!activeField) return;
    saveChart(dataset.id, {
      fieldKey:  activeField.key,
      chartType,
      title,
      config,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  // ── 字段列表（可图表 + 文本分开） ───────────────────────
  const chartableFields = dataset.fields.filter(isChartable);
  const textFieldCount  = dataset.fields.length - chartableFields.length;

  // ── 样本数 ───────────────────────────────────────────────
  const validSamples = chartData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* ── 左栏：字段选择 ──────────────────────────────── */}
        <div className="md:col-span-1">
          <div className="text-[11px] font-600 text-black/35 px-1 mb-2 tracking-wide uppercase">
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
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-ios text-left transition-all',
                    isActive
                      ? 'bg-[#007AFF]/08 border border-[#007AFF]/20 shadow-sm'
                      : 'hover:bg-black/04 border border-transparent',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn(
                        'text-[13px] font-500 truncate transition-colors',
                        isActive ? 'text-[#007AFF]' : 'text-black/65',
                      )}>
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-full text-[10px] font-500 flex-shrink-0',
                        TYPE_COLORS[f.type],
                      )}>
                        {TYPE_LABELS[f.type]}
                      </span>
                      {f.statistics && (
                        <span className="text-[10px] text-black/25 tabular-nums">
                          {f.statistics.unique} 唯一值
                        </span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF] flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {textFieldCount > 0 && (
              <div className="px-3 py-2 text-[10px] text-black/25 flex items-center gap-1.5">
                <span className="flex-1 h-px bg-black/08 rounded" />
                {textFieldCount} 个文本字段不支持图表
                <span className="flex-1 h-px bg-black/08 rounded" />
              </div>
            )}
          </div>
        </div>

        {/* ── 右栏：图表预览区 ─────────────────────────────── */}
        <div className="md:col-span-3 space-y-3">

          {activeField ? (
            <>
              {/* 图表类型切换 + 日期粒度 */}
              <div className="flex items-center gap-2 flex-wrap">
                {availableTypes.map(t => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] font-500 transition-all',
                      chartType === t
                        ? 'bg-[#007AFF] text-white shadow-sm'
                        : 'bg-black/06 text-black/50 hover:bg-black/10 hover:text-black/70',
                    )}
                  >
                    {CHART_ICONS[t]}
                    {CHART_LABELS[t]}
                  </button>
                ))}

                {/* 日期粒度（仅日期字段显示） */}
                {activeField.type === 'date' && (
                  <div className="ml-auto flex items-center gap-1 bg-black/05 rounded-ios p-0.5">
                    {(Object.keys(DATE_GRAN_LABELS) as DateGran[]).map(g => (
                      <button
                        key={g}
                        onClick={() => setDateGran(g)}
                        className={cn(
                          'px-2.5 py-1 rounded-[6px] text-[11px] font-500 transition-all',
                          dateGran === g
                            ? 'bg-white text-black/70 shadow-sm'
                            : 'text-black/40 hover:text-black/60',
                        )}
                      >
                        {DATE_GRAN_LABELS[g]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 图表卡片 */}
              {chartData.length > 0 ? (
                <ChartCard
                  title={activeField.name}
                  data={chartData}
                  config={config}
                  chartType={chartType}
                  isMultiSelect={activeField.type === 'multi_choice'}
                  totalSamples={dataset.rowCount}
                  validSamples={validSamples}
                  onConfigChange={handleConfigChange}
                  showLegendOption
                  className="shadow-none border border-black/06"
                />
              ) : (
                <div className="glass-card p-10 text-center border border-black/06">
                  <div className="text-[13px] text-black/30">该字段无可聚合数据</div>
                  <div className="text-[11px] text-black/20 mt-1">请检查字段值是否为空</div>
                </div>
              )}

              {/* 数据摘要 + 保存按钮 */}
              {chartData.length > 0 && (
                <div className="flex items-center gap-4 px-1">
                  <span className="flex items-center gap-1 text-[11px] text-black/30">
                    <MousePointerClick size={10} />
                    {chartData.length} 个分类
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-black/30">
                    <BarChart2 size={10} />
                    {validSamples.toLocaleString()} / {dataset.rowCount.toLocaleString()} 行
                  </span>
                  {activeField.type === 'date' && (
                    <span className="flex items-center gap-1 text-[11px] text-black/30">
                      <CalendarDays size={10} />
                      {DATE_GRAN_LABELS[dateGran]}
                    </span>
                  )}
                  {/* 保存到面板 */}
                  <button
                    onClick={() => handleSaveChart(activeField.name)}
                    disabled={justSaved}
                    className={cn(
                      'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] font-500 transition-all',
                      justSaved
                        ? 'bg-[#34C759]/12 text-[#34C759] cursor-default'
                        : 'bg-black/06 text-black/50 hover:bg-[#5856D6]/10 hover:text-[#5856D6]',
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
            /* 未选字段的空态 */
            <div className="glass-card p-12 text-center border border-black/06">
              <BarChart2 size={32} className="mx-auto mb-3 text-black/12" />
              <div className="text-[14px] font-500 text-black/30 mb-1">选择一个字段开始</div>
              <div className="text-[12px] text-black/20">
                支持单选、多选、数值、日期、布尔类型
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
