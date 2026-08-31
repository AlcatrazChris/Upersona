'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, ResponsiveContainer,
} from 'recharts';
import type { GroupedChartData } from '@/lib/dataAggregator';
import type { ChartConfig } from '@/lib/chartConfig';
import { getColors } from '@/lib/chartConfig';
import { useResizableYAxisWidth, YAxisResizeHandle } from './shared';

export interface GroupedBarChartEngineProps {
  data: GroupedChartData;
  mode: 'grouped' | 'stacked';
  config: ChartConfig;
  height?: number;
  className?: string;
  /** Optional per-series colour overrides (indexed same as seriesKeys). */
  seriesColors?: string[];
  /** Disable content-driven expansion when the caller provides a resizable height. */
  autoHeight?: boolean;
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
    <div className="min-w-[180px] max-w-[260px] rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 text-xs font-semibold text-slate-900">{label}</div>
      {payload.map(e => {
        const n = data.groupTotals[e.name] ?? 0;
        const raw = data.rawCounts[e.name]?.[label] ?? 0;
        return (
          <div key={e.name} className="flex items-center gap-2 py-0.5 text-xs text-slate-600">
            <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: e.color }} />
            <span className="flex-1 truncate">
              {e.name}
              {showSampleCount && (
                <span className="text-gray-400 ml-1 tabular-nums">(n={n.toLocaleString()})</span>
              )}
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">{e.value.toFixed(1)}%</span>
            <span className="ml-1 text-slate-500 tabular-nums">({raw})</span>
          </div>
        );
      })}
    </div>
  );
}

export function GroupedBarChartEngine({
  data, mode, config, height = 320, className, seriesColors, autoHeight = true,
}: GroupedBarChartEngineProps) {
  const { items, seriesKeys, groupTotals } = data;
  const isStacked = mode === 'stacked';
  const schemeColors = getColors(config.colorScheme);

  // Y-axis width: ~13px per Chinese char, min 60, max 130
  const maxLabelLen = Math.max(...items.map(d => String(d.label).length), 4);
  const yAxis = useResizableYAxisWidth(Math.min(130, Math.max(60, maxLabelLen * 13)));
  const yWidth = yAxis.width;

  // Dynamic height: ensure each bar is at least minBarSize px tall
  const minBarH      = config.minBarSize;
  const barsPerCat   = isStacked ? 1 : seriesKeys.length;
  const categoryGap  = Math.round(minBarH * 0.6);
  const requiredH    = items.length * (barsPerCat * minBarH + categoryGap) + 60;
  const requestedHeight = config.chartHeight ?? height;
  const actualHeight = autoHeight ? Math.max(requestedHeight, requiredH) : requestedHeight;

  // Right margin: leave room for bar-end labels when showLabel is on
  const rightMargin = config.showLabel && !isStacked ? 46 : 12;

  return (
    <div className={`relative ${className ?? ''}`} style={{ height: actualHeight, background: config.backgroundColor, fontFamily: config.fontFamily, padding: config.chartPadding }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={items}
          margin={{ top: 4, right: rightMargin, left: 0, bottom: 4 }}
          barCategoryGap="22%"
          barGap={isStacked ? 0 : config.barGap}
          barSize={minBarH}
        >
          {config.showGrid && (
            <CartesianGrid stroke={config.gridColor} horizontal={false} />
          )}

          {/* Always render axes with hide prop — avoids recharts defaulting to
              category-type X axis in vertical layout, which collapses bar widths. */}
          <XAxis
            type="number"
            hide={!config.showXAxis}
            tickFormatter={(v: number) => `${Number(v).toFixed(1)}%`}
            domain={[config.axisMin ?? (config.startAtZero ? 0 : 'auto'), config.axisMax ?? 'auto']}
            tickCount={config.tickCount}
            label={config.xAxisTitle ? { value: config.xAxisTitle, position: 'insideBottom', offset: -2, fontSize: config.axisFontSize } : undefined}
            tick={{ fontSize: config.axisFontSize, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={config.showYAxis ? yWidth : 0}
            hide={!config.showYAxis}
            tick={{ fontSize: config.axisFontSize, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            label={config.yAxisTitle ? { value: config.yAxisTitle, angle: -90, position: 'insideLeft', fontSize: config.axisFontSize } : undefined}
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
              formatter={(value: string) => {
                // Truncate long series names (e.g., dataset names in cross-compare)
                const MAX = 16;
                const display = value.length > MAX ? value.slice(0, MAX - 1) + '…' : value;
                return config.showSampleCount
                  ? `${display}  (n=${(groupTotals[value] ?? 0).toLocaleString()})`
                  : display;
              }}
              wrapperStyle={{ fontSize: config.legendFontSize, paddingTop: config.legendPosition === 'bottom' ? 8 : 0 }}
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
                  formatter={(v: number) => v > 0 ? `${v.toFixed(1)}%` : ''}
                  style={{ fontSize: config.labelFontSize, fill: '#475569', fontWeight: 500 }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      {config.showYAxis && (
        <YAxisResizeHandle
          width={yAxis.width}
          offset={config.chartPadding}
          onResizeStart={yAxis.onResizeStart}
          onResizeKeyDown={yAxis.onResizeKeyDown}
          onReset={yAxis.resetWidth}
        />
      )}
    </div>
  );
}
