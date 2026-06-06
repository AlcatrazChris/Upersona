'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList, CartesianGrid,
} from 'recharts';
import { getColors } from '@/lib/chartConfig';
import { ChartTooltip, BarLabelContent, cfgLabelRight } from './shared';
import type { ChartEngineProps } from './types';

/**
 * 横向条形图引擎
 *
 * 自动根据数据条数计算高度；通过 ChartConfig 控制所有显示开关。
 */
export function BarChartEngine({
  data, config, isMultiSelect = false, totalSamples, height,
}: ChartEngineProps) {
  const colors  = getColors(config.colorScheme);
  const barH    = 26;
  const chartH  = height ?? Math.max(160, data.length * barH + 40);
  const rightM  = cfgLabelRight(config);

  return (
    <div style={{ height: chartH }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: rightM, top: 0, bottom: 0 }}
          barCategoryGap="20%"
        >
          {config.showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.06)"
              horizontal={false}
            />
          )}

          {config.showXAxis && (
            <XAxis
              type="number"
              tick={{ fontSize: config.axisFontSize, fill: 'rgba(0,0,0,0.30)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
            />
          )}

          {config.showYAxis && (
            <YAxis
              type="category"
              dataKey="label"
              width={86}
              tick={{ fontSize: config.axisFontSize, fill: 'rgba(0,0,0,0.55)' }}
              axisLine={false}
              tickLine={false}
            />
          )}

          {config.showTooltip && (
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  payload={payload as { payload: typeof data[0] }[]}
                  isMultiSelect={isMultiSelect}
                  totalSamples={totalSamples}
                />
              )}
            />
          )}

          <Bar
            dataKey="percentage"
            radius={[0, config.barRadius, config.barRadius, 0]}
            barSize={18}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
                fillOpacity={config.barOpacity}
              />
            ))}

            {config.showLabel && (
              <LabelList
                dataKey="percentage"
                position="right"
                content={(props) => (
                  <BarLabelContent
                    {...props}
                    items={data}
                    labelType={config.labelType}
                    fontSize={config.labelFontSize}
                  />
                )}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
