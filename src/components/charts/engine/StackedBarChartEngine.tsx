'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, ResponsiveContainer, Cell,
} from 'recharts';
import type { GroupedChartData } from '@/lib/dataAggregator';
import type { ChartConfig } from '@/lib/chartConfig';
import { getColors } from '@/lib/chartConfig';

export interface StackedBarChartEngineProps {
  data: GroupedChartData;
  config: ChartConfig;
  height?: number;
  className?: string;
}

// Custom X-axis tick: group name + n=xxx below
function XTick({
  x, y, payload, groupTotals, axisFontSize, showSampleCount,
}: {
  x?: number; y?: number;
  payload?: { value: string };
  groupTotals: Record<string, number>;
  axisFontSize: number;
  showSampleCount: boolean;
}) {
  if (!x || !y || !payload?.value) return null;
  const n = groupTotals[payload.value] ?? 0;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" fill="#374151"
        fontSize={axisFontSize} fontWeight={500}>
        {payload.value}
      </text>
      {showSampleCount && (
        <text x={0} y={0} dy={27} textAnchor="middle" fill="#9ca3af"
          fontSize={Math.max(9, axisFontSize - 2)}>
          n={n.toLocaleString()}
        </text>
      )}
    </g>
  );
}

interface TooltipEntry { name: string; value: number; color: string }

function TooltipContent({
  active, payload, label, data,
}: {
  active?: boolean; payload?: TooltipEntry[]; label?: string;
  data: GroupedChartData;
}) {
  if (!active || !payload?.length || !label) return null;
  const total = data.groupTotals[label] ?? 0;
  const entries = [...payload].reverse();

  return (
    <div className="min-w-[180px] max-w-[240px] rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 text-xs font-semibold text-slate-900">
        {label}
        <span className="text-gray-400 font-normal ml-1.5 tabular-nums">n={total.toLocaleString()}</span>
      </div>
      {entries.map(e => {
        const raw = data.rawCounts[label]?.[e.name] ?? 0;
        return (
          <div key={e.name} className="flex items-center gap-2 py-0.5 text-xs text-slate-600">
            <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: e.color }} />
            <span className="flex-1 truncate">{e.name}</span>
            <span className="font-semibold text-slate-900 tabular-nums">{e.value.toFixed(1)}%</span>
            <span className="text-gray-400 tabular-nums ml-0.5">({raw})</span>
          </div>
        );
      })}
    </div>
  );
}

export function StackedBarChartEngine({
  data, config, height = 320, className,
}: StackedBarChartEngineProps) {
  const { stackItems, stackSeriesKeys, groupTotals } = data;
  const schemeColors = getColors(config.colorScheme);
  const actualHeight = config.chartHeight ?? height;
  const bottomMargin = config.showSampleCount ? 44 : 28;

  return (
    <div className={className} style={{ height: actualHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={stackItems}
          margin={{ top: 8, right: 16, left: 0, bottom: bottomMargin }}
          barCategoryGap="30%"
        >
          {config.showGrid && (
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
          )}

          {config.showXAxis && (
            <XAxis
              dataKey="label"
              tick={
                <XTick
                  groupTotals={groupTotals}
                  axisFontSize={config.axisFontSize}
                  showSampleCount={config.showSampleCount}
                />
              }
              axisLine={false}
              tickLine={false}
              interval={0}
            />
          )}

          {config.showYAxis && (
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${Number(v).toFixed(1)}%`}
              tick={{ fontSize: config.axisFontSize, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
          )}

          {config.showTooltip && (
            <Tooltip
              content={({ active, payload, label: lbl }) => (
                <TooltipContent
                  active={active}
                  payload={payload as TooltipEntry[]}
                  label={lbl?.toString()}
                  data={data}
                />
              )}
              cursor={{ fill: '#f1f5f9' }}
            />
          )}

          {config.showLegend && (
            <Legend
              verticalAlign={config.legendPosition === 'top' || config.legendPosition === 'bottom' ? config.legendPosition : 'middle'}
              align={config.legendPosition === 'left' || config.legendPosition === 'right' ? config.legendPosition : 'center'}
              layout={config.legendDirection}
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: config.legendFontSize, paddingBottom: config.legendPosition === 'top' ? 8 : 0 }}
            />
          )}

          {stackSeriesKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId="stack"
              fill={schemeColors[i % schemeColors.length]}
              opacity={config.barOpacity}
            >
              {config.showLabel && (
                <LabelList
                  dataKey={key}
                  position="inside"
                  content={(props) => {
                    const { x, y, width, height: h, value } = props as {
                      x: number; y: number; width: number; height: number; value: number;
                    };
                    if (!value || value < 4 || !h || h < 14) return null;
                    return (
                      <text
                        x={x + width / 2}
                        y={y + h / 2 + 4}
                        textAnchor="middle"
                        fill="white"
                        fontSize={config.labelFontSize}
                        fontWeight={600}
                      >
                        {`${value.toFixed(1)}%`}
                      </text>
                    );
                  }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
