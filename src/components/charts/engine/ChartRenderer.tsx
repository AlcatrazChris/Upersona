'use client';

import { BarChartEngine }  from './BarChartEngine';
import { PieChartEngine }  from './PieChartEngine';
import { LineChartEngine } from './LineChartEngine';
import type { ChartEngineProps, ChartType } from './types';

interface ChartRendererProps extends ChartEngineProps {
  /** 图表类型：bar | pie | donut | line | area */
  type?: ChartType;
  /** 多选题强制使用条形图（饼图不适合多选） */
}

/**
 * 图表渲染路由器
 *
 * 根据 type 把数据分发给对应引擎。
 * 多选题（isMultiSelect=true）自动降级为条形图。
 *
 * 使用方式：
 *   <ChartRenderer type="pie" data={items} config={cfg} />
 *   <ChartRenderer type={dim.chartType} data={items} config={cfg} isMultiSelect />
 */
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
    case 'pie':
      return <PieChartEngine {...props} isMultiSelect={isMultiSelect} donut={false} />;
    case 'donut':
      return <PieChartEngine {...props} isMultiSelect={isMultiSelect} donut={true} />;
    case 'line':
      return <LineChartEngine {...props} isMultiSelect={isMultiSelect} area={false} />;
    case 'area':
      return <LineChartEngine {...props} isMultiSelect={isMultiSelect} area={true} />;
    case 'bar':
    default:
      return <BarChartEngine {...props} isMultiSelect={isMultiSelect} />;
  }
}

// 便捷重导出，外部只需 import from engine
export type { ChartType, ChartEngineProps };
export { BarChartEngine, PieChartEngine, LineChartEngine };
