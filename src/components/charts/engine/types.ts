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

export type ChartType = 'bar' | 'pie' | 'donut' | 'line' | 'area' | 'grouped-bar' | 'stacked-bar' | 'ranking-heatmap';
