'use client';

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { getColors } from '@/lib/chartConfig';
import { ChartTooltip, PieSliceLabel, applyTopN } from './shared';
import type { ChartEngineProps } from './types';

const OTHERS_COLOR = '#b0bec5';

interface PieProps extends ChartEngineProps {
  donut?: boolean;
}

export function PieChartEngine({
  data: rawData, config, isMultiSelect = false, totalSamples, height, donut = true,
}: PieProps) {
  const data    = applyTopN(rawData, Math.min(config.topN || 5, 5));
  const colors  = getColors(config.colorScheme);
  const chartH  = height ?? 280;
  const innerR  = donut ? 44 : 0;
  const outerR  = donut ? 78 : 88;

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
            paddingAngle={1}
            label={(props) => (
              <PieSliceLabel
                {...props}
                showLabel={config.showLabel}
                labelType={config.labelType}
              />
            )}
            labelLine={false}
          >
            {data.map((item, i) => (
              <Cell
                key={i}
                fill={item.label === '其他' ? OTHERS_COLOR : colors[i % colors.length]}
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
              verticalAlign={config.legendPosition === 'top' ? 'top' : config.legendPosition === 'bottom' ? 'bottom' : 'middle'}
              align={config.legendPosition === 'left' ? 'left' : config.legendPosition === 'right' ? 'right' : 'center'}
              layout={config.legendPosition === 'left' || config.legendPosition === 'right' ? 'vertical' : 'horizontal'}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: config.legendFontSize,
                color: '#475569',
                paddingTop: 2,
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
