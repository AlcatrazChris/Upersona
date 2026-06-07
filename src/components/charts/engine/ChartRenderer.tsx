'use client';

import { BarChartEngine }  from './BarChartEngine';
import { PieChartEngine }  from './PieChartEngine';
import { LineChartEngine } from './LineChartEngine';
import type { ChartEngineProps, ChartType } from './types';

interface ChartRendererProps extends ChartEngineProps {
  type?: ChartType;
}

export function ChartRenderer({
  type = 'bar',
  isMultiSelect = false,
  ...props
}: ChartRendererProps) {
  // 多选题不适合饼图/折线图，强制回退到条形图
  const resolvedType: ChartType =
    isMultiSelect && (type === 'pie' || type === 'donut' || type === 'line' || type === 'area')
      ? 'bar'
      : type;

  switch (resolvedType) {
    case 'pie':   return <PieChartEngine  {...props} isMultiSelect={isMultiSelect} donut={false} />;
    case 'donut': return <PieChartEngine  {...props} isMultiSelect={isMultiSelect} donut={true} />;
    case 'line':  return <LineChartEngine {...props} isMultiSelect={isMultiSelect} area={false} />;
    case 'area':  return <LineChartEngine {...props} isMultiSelect={isMultiSelect} area={true} />;
    case 'bar':
    default:      return <BarChartEngine  {...props} isMultiSelect={isMultiSelect} />;
  }
}

export type { ChartType, ChartEngineProps };
export { BarChartEngine, PieChartEngine, LineChartEngine };
