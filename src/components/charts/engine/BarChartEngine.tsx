'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList, CartesianGrid,
} from 'recharts';
import { getColors, isSingleColorScheme } from '@/lib/chartConfig';
import {
  ChartTooltip, BarLabelContent, cfgLabelRight, applyTopN,
  useResizableYAxisWidth, YAxisResizeHandle,
} from './shared';
import type { ChartEngineProps } from './types';

const OTHERS_COLOR = '#b0bec5';

// Custom Y-axis tick: truncates long labels with ellipsis
function TruncatedYTick({ x, y, payload, fontSize, maxWidth }: {
  x: number; y: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  fontSize: number; maxWidth: number;
}) {
  const raw = String(payload?.value ?? '');
  const avgPx  = fontSize * 0.7;
  const maxCh  = Math.max(3, Math.floor(maxWidth / avgPx));
  const label  = raw.length > maxCh ? `${raw.slice(0, maxCh - 1)}…` : raw;
  return (
    <g transform={`translate(${x},${y})`}>
      {label !== raw && <title>{raw}</title>}
      <text
        x={-4} y={0}
        textAnchor="end"
        dominantBaseline="middle"
        fill="#475569"
        style={{ fontSize, pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

export function BarChartEngine({
  data: rawData, config, isMultiSelect = false, totalSamples, height,
}: ChartEngineProps) {
  // Aggregation owns category order: configured field order first, count-desc otherwise.
  const data = applyTopN(rawData, config.topN);
  const colors  = getColors(config.colorScheme);
  const useSingleColor = isSingleColorScheme(config.colorScheme);

  const compact = config.compact ?? false;
  const barH    = Math.max(compact ? 20 : 28, (config.minBarSize ?? 18) + (compact ? 4 : 10));
  const minH    = Math.max(compact ? 120 : 150, data.length * barH + (compact ? 24 : 36));
  const chartH  = config.chartHeight != null ? Math.max(config.chartHeight, minH) : minH;
  const rightM  = cfgLabelRight(config);
  const yAxis = useResizableYAxisWidth(104);
  const yAxisW = config.showYAxis ? yAxis.width : 0;

  function barFill(label: string, index: number): string {
    if (label === '其他') return OTHERS_COLOR;
    if (useSingleColor) return colors[0];
    return colors[index % colors.length];
  }

  return (
    <div className="relative" style={{ height: chartH, background: config.backgroundColor, fontFamily: config.fontFamily, padding: config.chartPadding }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: rightM, top: compact ? 0 : 2, bottom: compact ? 0 : 2 }}
          barCategoryGap={compact ? '15%' : '22%'}
        >
          {config.showGrid && (
            <CartesianGrid stroke={config.gridColor} horizontal={false} vertical />
          )}
          {/* Always render axes — using `hide` instead of conditional mount.
              In layout="vertical", omitting XAxis entirely causes recharts to
              infer a category-type X axis, making all bars except the first collapse. */}
          <XAxis
            type="number"
            domain={[config.axisMin ?? (config.startAtZero ? 0 : 'auto'), config.axisMax ?? 'auto']}
            tickCount={config.tickCount}
            hide={!config.showXAxis}
            tick={{ fontSize: config.axisFontSize, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${Number(v).toFixed(1)}%`}
            label={config.xAxisTitle ? { value: config.xAxisTitle, position: 'insideBottom', offset: -2, fontSize: config.axisFontSize } : undefined}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={yAxisW}
            hide={!config.showYAxis}
            interval={0}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tick={config.showYAxis ? (props: any) => (
              <TruncatedYTick
                {...props}
                fontSize={config.axisFontSize}
                maxWidth={yAxisW - 8}
              />
            ) : false}
            axisLine={false}
            tickLine={false}
            label={config.yAxisTitle ? { value: config.yAxisTitle, angle: -90, position: 'insideLeft', fontSize: config.axisFontSize } : undefined}
          />
          {config.showTooltip && (
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
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
            barSize={config.minBarSize ?? 18}
            isAnimationActive={config.animation}
          >
            {data.map((item, i) => (
              <Cell
                key={i}
                fill={barFill(item.label, i)}
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
                    decimalPlaces={config.decimalPlaces}
                    valuePrefix={config.valuePrefix}
                    valueSuffix={config.valueSuffix}
                    showZeroLabels={config.showZeroLabels}
                  />
                )}
              />
            )}
          </Bar>
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
