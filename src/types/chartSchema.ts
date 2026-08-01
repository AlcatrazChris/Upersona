import { z } from 'zod';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ChartType } from '@/components/charts/engine/types';

export const chartTypeSchema = z.enum([
  'bar', 'lollipop', 'waffle', 'pie', 'donut', 'line', 'area',
  'ranking-heatmap', 'grouped-bar', 'stacked-bar',
]);

const filterSchema = z.object({
  fieldKey: z.string().min(1),
  operator: z.enum(['in', 'not-in', 'eq', 'neq', 'exists']),
  values: z.array(z.string()).optional(),
});

export const chartSchemaValidator = z.object({
  version: z.literal(1),
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
    aggregation: z.enum(['count']).default('count'),
    filters: z.array(filterSchema).optional(),
    sort: z.enum(['default', 'value-asc', 'value-desc']).optional(),
    limit: z.number().int().positive().optional(),
  }),
  chart: z.object({ type: chartTypeSchema }),
  appearance: z.custom<ChartConfig>(),
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
  return {
    version: 1,
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
    appearance: chart.config,
    layout: {
      width: chart.canvasWidth,
      height: chart.config.chartHeight,
      position: chart.position,
      gridSpan: chart.gridSpan,
    },
  };
}
