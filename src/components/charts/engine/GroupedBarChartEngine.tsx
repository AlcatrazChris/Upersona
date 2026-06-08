'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, ResponsiveContainer,
} from 'recharts';
import type { GroupedChartData } from '@/lib/dataAggregator';
import type { ChartConfig } from '@/lib/chartConfig';
import { getColors } from '@/lib/chartConfig';

export interface GroupedBarChartEngineProps {
  data: GroupedChartData;
  mode: 'grouped' | 'stacked';
  config: ChartConfig;
  height?: number;
  className?: string;
  /** Optional per-series colour overrides (indexed same as seriesKeys). */
  seriesColors?: string[];
}

interface TooltipEntry { name: string; value: number; color: string }

function TooltipContent({
  active, payload, label, data, showSampleCount,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  data: GroupedChartData;
  showSampleCount: boolean;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-3 min-w-[160px] max-w-[240px]">
      <div className="text-xs font-semibold text-gray-700 mb-1.5">{label}</div>
      {payload.map(e => {
        const n = data.groupTotals[e.name] ?? 0;
        const raw = data.rawCounts[e.name]?.[label] ?? 0;
        return (
          <div key={e.name} className="flex items-center gap-1.5 text-xs text-gray-600 py-0.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: e.color }} />
            <span className="flex-1 truncate">
              {e.name}
              {showSampleCount && (
                <span className="text-gray-400 ml-1">(n={n.toLocaleString()})</span>
              )}
            </span>
            <span className="font-semibold tabular-nums">{e.value.toFixed(1)}%</span>
            <span className="text-gray-400 tabular-nums ml-1">({raw})</span>
          </div>
        );
      })}
    </div>
  );
}

export function GroupedBarChartEngine({
  data, mode, config, height = 320, className, seriesColors,
}: GroupedBarChartEngineProps) {
  const { items, seriesKeys, groupTotals } = data;
  const isStacked = mode === 'stacked';
  const schemeColors = getColors(config.colorScheme);

  // Y-axis width: ~13px per Chinese char, min 60, max 130
  const maxLabelLen = Math.max(...items.map(d => String(d.label).length), 4);
  const yWidth = Math.min(130, Math.max(60, maxLabelLen * 13));

  // Dynamic height: ensure each bar is at least minBarSize px tall
  const minBarH      = config.minBarSize;
  const barsPerCat   = isStacked ? 1 : seriesKeys.length;
  const categoryGap  = Math.round(minBarH * 0.6);
  const requiredH    = items.length * (barsPerCat * minBarH + categoryGap) + 60;
  const actualHeight = Math.max(config.chartHeight ?? height, requiredH);

  // Right margin: leave room for bar-end labels when showLabel is on
  const rightMargin = config.showLabel && !isStacked ? 46 : 12;

  return (
    <div className={className} style={{ height: actualHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={items}
          margin={{ top: 4, right: rightMargin, left: 0, bottom: 4 }}
          barCategoryGap="22%"
          barGap={isStacked ? 0 : 3}
          barSize={minBarH}
        >
          {config.showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          )}

          {/* Always render axes with hide prop — avoids recharts defaulting to
              category-type X axis in vertical layout, which collapses bar widths. */}
          <XAxis
            type="number"
            hide={!config.showXAxis}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: config.axisFontSize, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={config.showYAxis ? yWidth : 0}
            hide={!config.showYAxis}
            tick={{ fontSize: config.axisFontSize, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />

          {config.showTooltip && (
            <Tooltip
              content={({ active, payload, label: lbl }) => (
                <TooltipContent
                  active={active}
                  payload={payload as TooltipEntry[]}
                  label={lbl?.toString()}
                  data={data}
                  showSampleCount={config.showSampleCount}
                />
              )}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
          )}

          {config.showLegend && (
            <Legend
              verticalAlign="bottom"
              iconType="square"
              iconSize={8}
              formatter={(value: string) => {
                // Truncate long series names (e.g., dataset names in cross-compare)
                const MAX = 16;
                const display = value.length > MAX ? value.slice(0, MAX - 1) + '…' : value;
                return config.showSampleCount
                  ? `${display}  (n=${(groupTotals[value] ?? 0).toLocaleString()})`
                  : display;
              }}
              wrapperStyle={{ fontSize: config.legendFontSize, paddingTop: 8 }}
            />
          )}

          {seriesKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId={isStacked ? 'stack' : undefined}
              fill={seriesColors?.[i] ?? schemeColors[i % schemeColors.length]}
              radius={
                !isStacked
                  ? [0, config.barRadius, config.barRadius, 0] as [number, number, number, number]
                  : undefined
              }
              opacity={config.barOpacity}
            >
              {config.showLabel && !isStacked && (
                <LabelList
                  dataKey={key}
                  position="right"
                  formatter={(v: number) => v > 0 ? `${v.toFixed(0)}%` : ''}
                  style={{ fontSize: config.labelFontSize, fill: '#6b7280' }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
