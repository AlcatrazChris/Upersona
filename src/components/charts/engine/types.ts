import type { ChartConfig } from '@/lib/chartConfig';

export interface ChartDataItem {
  label:      string;
  count:      number;
  percentage: number;
  group?:     string;
}

export interface ChartEngineProps {
  data:           ChartDataItem[];
  config:         ChartConfig;
  isMultiSelect?: boolean;
  totalSamples?:  number;
  height?:        number;
  className?:     string;
}

export type FlatChartType = 'bar' | 'lollipop' | 'waffle' | 'pie' | 'donut' | 'line' | 'area' | 'ranking-heatmap';
export type GroupChartType = 'grouped-bar' | 'stacked-bar';
export type ChartType = FlatChartType | GroupChartType;
