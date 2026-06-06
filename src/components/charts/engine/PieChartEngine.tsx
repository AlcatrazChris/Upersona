'use client';

import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getColors } from '@/lib/chartConfig';
import { ChartTooltip, PieSliceLabel } from './shared';
import type { ChartEngineProps } from './types';

interface PieProps extends ChartEngineProps {
  /** true → 环形图（donut），false → 实心饼图 */
  donut?: boolean;
}

/**
 * 饼图 / 环形图引擎
 *
 * - donut=true  → 内径 44，外径 78（默认）
 * - donut=false → 内径 0，外径 88（实心）
 * - 饼片内显示百分比标签（< 4% 的扇区隐藏标签防遮挡）
 */
export function PieChartEngine({
  data, config, isMultiSelect = false, totalSamples, height, donut = true,
}: PieProps) {
  const colors     = getColors(config.colorScheme);
  const chartH     = height ?? 280;
  const innerR     = donut ? 44 : 0;
  const outerR     = donut ? 78 : 88;

  return (
    <div style={{ height: chartH }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={data}
            dataKey="percentage"
            nameKey="label"
            cx="50%"
            cy="44%"
            innerRadius={innerR}
            outerRadius={outerR}
            paddingAngle={2}
            label={(props) => (
              <PieSliceLabel
                {...props}
                showLabel={config.showLabel}
                labelType={config.labelType}
              />
            )}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
                fillOpacity={config.barOpacity}
              />
            ))}
          </Pie>

          {config.showTooltip && (
            <Tooltip
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

          {config.showLegend && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: config.legendFontSize - 1,
                color: 'rgba(0,0,0,0.55)',
                paddingTop: 2,
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
