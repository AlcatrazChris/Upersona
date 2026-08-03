import { z } from 'zod';
import { DEFAULT_CHART_CONFIG } from '@/lib/chartConfig';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ChartType } from '@/components/charts/engine/types';

export const chartTypeSchema = z.enum([
  'bar', 'lollipop', 'waffle', 'pie', 'donut', 'line', 'area', 'boxplot', 'wordcloud',
  'ranking-heatmap', 'grouped-bar', 'stacked-bar',
]);

const filterSchema = z.object({
  fieldKey: z.string().min(1),
  operator: z.enum(['in', 'not-in', 'eq', 'neq', 'exists']),
  values: z.array(z.string()).optional(),
});

export const chartSchemaValidator = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  id: z.string().min(1),
  presentation: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
  data: z.object({
    datasetId: z.string().min(1),
    fieldKey: z.string().min(1),
    groupFieldKey: z.string().optional(),
    selectedGroups: z.array(z.string()).optional(),
    dateGranularity: z.enum(['year', 'month', 'day']).optional(),
    aggregation: z.enum(['count', 'distinct-count', 'sum', 'average', 'min', 'max']).default('count'),
    measureFieldKey: z.string().optional(),
    filters: z.array(filterSchema).optional(),
    sort: z.enum(['default', 'value-asc', 'value-desc']).optional(),
    limit: z.number().int().positive().optional(),
  }),
  chart: z.object({ type: chartTypeSchema }),
  appearance: z.custom<ChartConfig>(),
  axes: z.object({
    x: z.object({ title: z.string().optional(), min: z.number().optional(), max: z.number().optional(), startAtZero: z.boolean().optional(), tickCount: z.number().int().positive().optional() }).optional(),
    y: z.object({ title: z.string().optional(), min: z.number().optional(), max: z.number().optional(), startAtZero: z.boolean().optional(), tickCount: z.number().int().positive().optional() }).optional(),
  }).optional(),
  labels: z.object({ visible: z.boolean(), content: z.enum(['percentage', 'value', 'both', 'category']), position: z.enum(['auto', 'inside', 'outside', 'center']), decimalPlaces: z.number().int().min(0).max(6), prefix: z.string().optional(), suffix: z.string().optional() }).optional(),
  legend: z.object({ visible: z.boolean(), position: z.enum(['top', 'bottom', 'left', 'right']), direction: z.enum(['horizontal', 'vertical']) }).optional(),
  tooltip: z.object({ visible: z.boolean() }).optional(),
  interactions: z.object({ animation: z.boolean().optional(), legendToggle: z.boolean().optional() }).optional(),
  layout: z.object({
    width: z.number().positive().optional(),
    height: z.number().positive(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    gridSpan: z.union([z.literal(1), z.literal(2)]).optional(),
  }),
});

export type ChartSchema = z.infer<typeof chartSchemaValidator>;

export interface LegacyChartConfig {
  id: string;
  fieldKey: string;
  chartType: ChartType;
  title: string;
  config: ChartConfig;
  groupFieldKey?: string;
  selectedGroups?: string[];
  dateGranularity?: 'year' | 'month' | 'day';
  position?: { x: number; y: number };
  canvasWidth?: number;
  gridSpan?: 1 | 2;
}

export function chartSchemaFromLegacy(datasetId: string, chart: LegacyChartConfig): ChartSchema {
  const config = { ...DEFAULT_CHART_CONFIG, ...chart.config };
  return {
    version: 2,
    id: chart.id,
    presentation: { title: chart.title },
    data: {
      datasetId,
      fieldKey: chart.fieldKey,
      groupFieldKey: chart.groupFieldKey,
      selectedGroups: chart.selectedGroups,
      dateGranularity: chart.dateGranularity,
      aggregation: 'count',
    },
    chart: { type: chart.chartType },
    appearance: config,
    axes: {
      x: { title: config.xAxisTitle, min: config.axisMin, max: config.axisMax, startAtZero: config.startAtZero, tickCount: config.tickCount },
      y: { title: config.yAxisTitle, min: config.axisMin, max: config.axisMax, startAtZero: config.startAtZero, tickCount: config.tickCount },
    },
    labels: { visible: config.showLabel, content: config.labelType === 'pct' ? 'percentage' : config.labelType === 'count' ? 'value' : 'both', position: config.labelPosition, decimalPlaces: config.decimalPlaces, prefix: config.valuePrefix, suffix: config.valueSuffix },
    legend: { visible: config.showLegend, position: config.legendPosition, direction: config.legendDirection },
    tooltip: { visible: config.showTooltip },
    interactions: { animation: config.animation, legendToggle: true },
    layout: {
      width: chart.canvasWidth,
      height: config.chartHeight,
      position: chart.position,
      gridSpan: chart.gridSpan,
    },
  };
}
