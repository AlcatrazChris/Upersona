'use client';

import { BarChartEngine }          from './BarChartEngine';
import { PieChartEngine }          from './PieChartEngine';
import { LineChartEngine }         from './LineChartEngine';
import { RankingHeatmapEngine }    from './RankingHeatmapEngine';
import { GroupedBarChartEngine }   from './GroupedBarChartEngine';
import { StackedBarChartEngine }   from './StackedBarChartEngine';
import { LollipopChartEngine }     from './LollipopChartEngine';
import { WaffleChartEngine }       from './WaffleChartEngine';
import { BoxPlotEngine }           from './BoxPlotEngine';
import { WordCloudEngine }         from './WordCloudEngine';
import type { ChartEngineProps, FlatChartType } from './types';
import type { GroupedChartData, RankingData } from '@/lib/dataAggregator';
import type { ChartConfig } from '@/lib/chartConfig';

interface ChartRendererProps extends ChartEngineProps {
  type?:        FlatChartType;
  rankingData?: RankingData;
  fieldName?:   string;
  numericValues?: number[];
}

export function ChartRenderer({
  type = 'bar',
  isMultiSelect = false,
  rankingData,
  fieldName = '',
  numericValues = [],
  ...props
}: ChartRendererProps) {
  if (type === 'boxplot' && numericValues.length) {
    return <BoxPlotEngine values={numericValues} config={props.config} height={props.height} />;
  }
  if (type === 'ranking-heatmap' && rankingData) {
    return <RankingHeatmapEngine data={rankingData} fieldName={fieldName} height={props.height} />;
  }

  if (!props.data.length) {
    return (
      <div
        className="flex min-h-60 flex-col items-center justify-center rounded-lg bg-slate-50 px-6 text-center"
        role="status"
      >
        <p className="text-sm font-medium text-slate-700">暂无可展示的数据</p>
        <p className="mt-1 text-xs text-slate-500">请调整筛选条件或选择其他字段。</p>
      </div>
    );
  }

  // 排序题 → 专用热力图引擎
  // 多选题不适合饼图/折线图，强制回退到条形图
  const resolvedType: FlatChartType =
    isMultiSelect && (type === 'pie' || type === 'donut' || type === 'line' || type === 'area')
      ? 'bar'
      : type;

  switch (resolvedType) {
    case 'pie':   return <PieChartEngine  {...props} isMultiSelect={isMultiSelect} donut={false} />;
    case 'donut': return <PieChartEngine  {...props} isMultiSelect={isMultiSelect} donut={true} />;
    case 'line':  return <LineChartEngine {...props} isMultiSelect={isMultiSelect} area={false} />;
    case 'area':  return <LineChartEngine {...props} isMultiSelect={isMultiSelect} area={true} />;
    case 'lollipop': return <LollipopChartEngine {...props} isMultiSelect={isMultiSelect} />;
    case 'waffle': return <WaffleChartEngine {...props} isMultiSelect={isMultiSelect} />;
    case 'wordcloud': return <WordCloudEngine {...props} isMultiSelect={isMultiSelect} />;
    case 'bar':
    default:      return <BarChartEngine  {...props} isMultiSelect={isMultiSelect} />;
  }
}

export function GroupChartRenderer({
  type,
  data,
  config,
  height,
  seriesColors,
  autoHeight,
}: {
  type: 'grouped' | 'stacked';
  data: GroupedChartData;
  config: ChartConfig;
  height?: number;
  seriesColors?: string[];
  autoHeight?: boolean;
}) {
  return type === 'stacked'
    ? <StackedBarChartEngine data={data} config={config} height={height} />
    : (
      <GroupedBarChartEngine
        data={data}
        mode="grouped"
        config={config}
        height={height}
        seriesColors={seriesColors}
        autoHeight={autoHeight}
      />
    );
}

export type { ChartType, FlatChartType, ChartEngineProps } from './types';
export { BarChartEngine, PieChartEngine, LineChartEngine, RankingHeatmapEngine };
