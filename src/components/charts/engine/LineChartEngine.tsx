'use client';

import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts';
import { getColors } from '@/lib/chartConfig';
import { ChartTooltip } from './shared';
import type { ChartEngineProps } from './types';

interface LineProps extends ChartEngineProps {
  /** true → 渲染面积图（AreaChart），false → 折线图（LineChart） */
  area?: boolean;
}

/**
 * 折线图 / 面积图引擎
 *
 * 横轴为 label（分类）、纵轴为 percentage（0–100）。
 * 适合有序分类（如年龄段、城市级别、日期趋势）的数据展示。
 */
export function LineChartEngine({
  data, config, isMultiSelect = false, totalSamples, height, area = false,
}: LineProps) {
  const colors  = getColors(config.colorScheme);
  const color   = colors[0];
  const chartH  = height ?? 220;

  // 自动计算 Y 轴上限（留 10% 空间）
  const maxPct = Math.max(...data.map(d => d.percentage), 1);
  const yMax   = Math.min(100, Math.ceil(maxPct / 10) * 10 + 10);

  const commonProps = {
    data,
    margin: { left: -10, right: config.showLabel ? 40 : 8, top: 16, bottom: 4 },
  };

  const xAxis = config.showXAxis ? (
    <XAxis
      dataKey="label"
      tick={{ fontSize: config.axisFontSize - 1, fill: 'rgba(0,0,0,0.40)' }}
      axisLine={false}
      tickLine={false}
    />
  ) : null;

  const yAxis = config.showYAxis ? (
    <YAxis
      domain={[0, yMax]}
      tick={{ fontSize: config.axisFontSize - 1, fill: 'rgba(0,0,0,0.30)' }}
      axisLine={false}
      tickLine={false}
      tickFormatter={v => `${v}%`}
    />
  ) : null;

  const grid = config.showGrid ? (
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
  ) : null;

  const tooltip = config.showTooltip ? (
    <Tooltip
      cursor={{ stroke: 'rgba(0,0,0,0.08)', strokeWidth: 1 }}
      content={({ active, payload }) => (
        <ChartTooltip
          active={active}
          payload={payload as { payload: typeof data[0] }[]}
          isMultiSelect={isMultiSelect}
          totalSamples={totalSamples}
        />
      )}
    />
  ) : null;

  // 平均值参考线
  const avg = data.length > 0
    ? data.reduce((s, d) => s + d.percentage, 0) / data.length
    : 0;

  const refLine = (
    <ReferenceLine
      y={avg}
      stroke="rgba(0,0,0,0.15)"
      strokeDasharray="4 3"
      label={{ value: `均值 ${avg.toFixed(1)}%`, position: 'right', fontSize: 10, fill: 'rgba(0,0,0,0.30)' }}
    />
  );

  const label = config.showLabel ? (
    <LabelList
      dataKey="percentage"
      position="top"
      formatter={(v: number) => `${v.toFixed(1)}%`}
      style={{ fontSize: config.labelFontSize - 1, fill: 'rgba(0,0,0,0.40)', fontWeight: 500 }}
    />
  ) : null;

  return (
    <div style={{ height: chartH }}>
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart {...commonProps}>
            {grid}{xAxis}{yAxis}{tooltip}{refLine}
            <defs>
              <linearGradient id={`area-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="percentage"
              stroke={color}
              strokeWidth={2}
              fill={`url(#area-grad-${color.replace('#', '')})`}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color, stroke: 'white', strokeWidth: 2 }}
              fillOpacity={config.barOpacity}
            >
              {label}
            </Area>
          </AreaChart>
        ) : (
          <LineChart {...commonProps}>
            {grid}{xAxis}{yAxis}{tooltip}{refLine}
            <Line
              type="monotone"
              dataKey="percentage"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3.5, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color, stroke: 'white', strokeWidth: 2 }}
              fillOpacity={config.barOpacity}
            >
              {label}
            </Line>
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
