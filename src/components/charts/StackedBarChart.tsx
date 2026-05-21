'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LabelList, Legend,
} from 'recharts';
import { getColors } from '@/lib/chartConfig';
import type { ChartConfig, LegendPosition } from '@/lib/chartConfig';
import type { CompareData } from '@/types';

interface Props {
  data: CompareData;
  config: ChartConfig;
  chartHeight?: number;   // 可外部控制高度
  maxBarWidth?: number;   // 可外部控制每条柱子最大宽度
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.value > 0);
  return (
    <div className="glass-card-elevated px-3 py-2.5 min-w-[160px] max-w-[220px]">
      <div className="text-[12px] font-600 text-black/75 mb-2">{label}</div>
      <div className="space-y-1">
        {items.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
              <span className="text-[11px] text-black/60 truncate">{p.name}</span>
            </div>
            <span className="text-[11px] font-500 text-black/70 tabular-nums">{p.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StackedBarChart({ data, config, chartHeight = 300, maxBarWidth = 60 }: Props) {
  const { regions, allLabels } = data;
  const colors = getColors(config.colorScheme);

  const chartData = regions.map(r => {
    const row: Record<string, string | number> = {
      region: r.region,
      sampleCount: r.sampleCount,
    };
    for (const label of allLabels) {
      const found = r.distribution.find(d => d.label === label);
      row[label] = found ? parseFloat(found.percentage.toFixed(1)) : 0;
    }
    return row;
  });

  // X 轴自定义 tick：地区名 + 可选样本数
  const CustomXAxisTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string; index?: number } }) => {
    if (x == null || y == null || !payload) return null;
    const idx = payload.index ?? 0;
    const region = regions[idx];
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={14} textAnchor="middle"
          fill="rgba(0,0,0,0.65)" fontSize={config.axisFontSize} fontWeight={500}>
          {payload.value}
        </text>
        {config.showSampleCount && (
          <text x={0} y={0} dy={14 + config.axisFontSize + 3} textAnchor="middle"
            fill="rgba(0,0,0,0.35)" fontSize={Math.max(config.axisFontSize - 2, 9)}>
            n={region?.sampleCount ?? ''}
          </text>
        )}
      </g>
    );
  };

  const legendVerticalAlign: Record<LegendPosition, 'top' | 'bottom' | 'middle'> = {
    top: 'top', bottom: 'bottom', left: 'middle', right: 'middle',
  };
  const legendAlign: Record<LegendPosition, 'left' | 'center' | 'right'> = {
    top: 'center', bottom: 'center', left: 'left', right: 'right',
  };

  const xAxisHeight = config.showXAxis ? (config.showSampleCount ? 52 : 36) : 8;
  const topMargin   = config.showLegend && config.legendPosition === 'top'
    ? Math.ceil(allLabels.length / 4) * (config.legendFontSize + 8) + 8
    : 8;

  return (
    <div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: topMargin, right: 16, left: 0, bottom: config.showXAxis ? xAxisHeight : 8 }}
            barCategoryGap="20%"
            barSize={maxBarWidth}
          >
            {config.showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            )}
            {config.showXAxis && (
              <XAxis dataKey="region" tick={<CustomXAxisTick />}
                axisLine={false} tickLine={false} interval={0} height={xAxisHeight} />
            )}
            {config.showYAxis && (
              <YAxis tick={{ fontSize: config.axisFontSize, fill: 'rgba(0,0,0,0.30)' }}
                axisLine={false} tickLine={false} tickFormatter={v => `${v}%`}
                domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
            )}
            {config.showTooltip && (
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            )}
            {config.showLegend && (
              <Legend
                verticalAlign={legendVerticalAlign[config.legendPosition]}
                align={legendAlign[config.legendPosition]}
                formatter={value => (
                  <span style={{ fontSize: config.legendFontSize, color: 'rgba(0,0,0,0.55)' }}>{value}</span>
                )}
              />
            )}
            {allLabels.map((label, i) => (
              <Bar key={label} dataKey={label} stackId="stack" name={label}
                fill={colors[i % colors.length]} fillOpacity={config.barOpacity}
                radius={
                  i === 0                    ? [0, 0, config.barRadius, config.barRadius] :
                  i === allLabels.length - 1 ? [config.barRadius, config.barRadius, 0, 0] :
                  [0, 0, 0, 0]
                }>
                {config.showLabel && (
                  <LabelList dataKey={label} position="inside"
                    content={({ x, y, width, height, value }) => {
                      const v = Number(value);
                      if (!v || v < 8 || Number(width) < 30 || !height) return null;
                      return (
                        <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(height) / 2}
                          textAnchor="middle" dominantBaseline="central"
                          fill="white" fontSize={config.labelFontSize} fontWeight={600}>
                          {v.toFixed(0)}%
                        </text>
                      );
                    }} />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
