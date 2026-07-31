'use client';

import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip } from 'recharts';
import { applyTopN, ChartTooltip } from './shared';
import { getColors } from '@/lib/chartConfig';
import type { ChartEngineProps } from './types';

export function LollipopChartEngine({ data: raw, config, isMultiSelect, totalSamples, height }: ChartEngineProps) {
  const data = applyTopN(raw, config.topN);
  const color = getColors(config.colorScheme)[0];
  const chartHeight = height ?? config.chartHeight;
  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart layout="vertical" margin={{ top: 8, right: 42, bottom: 8, left: 8 }}>
          {config.showGrid && <CartesianGrid stroke="#e2e8f0" horizontal={false} />}
          <XAxis dataKey="percentage" type="number" hide={!config.showXAxis} domain={[0, 'dataMax']} unit="%" tick={{ fontSize: config.axisFontSize, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" hide={!config.showYAxis} width={104} tick={{ fontSize: config.axisFontSize, fill: '#475569' }} axisLine={false} tickLine={false} />
          <ZAxis range={[72, 72]} />
          {config.showTooltip && <Tooltip cursor={{ stroke: '#cbd5e1' }} content={({ active, payload }) => (
            <ChartTooltip active={active} payload={payload as { payload: typeof data[0] }[]} isMultiSelect={isMultiSelect} totalSamples={totalSamples} />
          )} />}
          <Scatter data={data} dataKey="percentage" fill={color} fillOpacity={config.barOpacity} line={{ stroke: color, strokeWidth: 2 }} shape="circle" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
