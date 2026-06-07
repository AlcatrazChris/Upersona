'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList, CartesianGrid,
} from 'recharts';
import { getColors } from '@/lib/chartConfig';
import { ChartTooltip, BarLabelContent, cfgLabelRight } from './shared';
import type { ChartEngineProps } from './types';

// ── Custom Y-axis tick: truncates long labels with ellipsis ──────
function TruncatedYTick({ x, y, payload, fontSize, maxWidth }: {
  x: number; y: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  fontSize: number; maxWidth: number;
}) {
  const raw = String(payload?.value ?? '');
  // CJK chars ≈ fontSize px wide; ASCII ≈ fontSize*0.55 px wide.
  // Use a conservative average of fontSize*0.7 for mixed text.
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
        fill="rgba(0,0,0,0.55)"
        style={{ fontSize, pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

export function BarChartEngine({
  data, config, isMultiSelect = false, totalSamples, height,
}: ChartEngineProps) {
  const colors  = getColors(config.colorScheme);
  // barH: minimum px per item so all Y-axis labels have room to render
  const barH    = Math.max(30, (config.minBarSize ?? 18) + 12);
  const minH    = Math.max(160, data.length * barH + 40);
  const chartH  = config.chartHeight != null ? Math.max(config.chartHeight, minH) : minH;
  const rightM  = cfgLabelRight(config);
  // Y-axis width — wider to handle longer Chinese labels
  const yAxisW  = config.showYAxis ? 104 : 0;

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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
          )}
          {/* Always render axes — using `hide` instead of conditional mount.
              In layout="vertical", omitting XAxis entirely causes recharts to
              infer a category-type X axis, which makes all bars except the
              first collapse to zero width. The `hide` prop keeps the axis in
              the internal layout without rendering it visually. */}
          <XAxis
            type="number"
            hide={!config.showXAxis}
            tick={{ fontSize: config.axisFontSize, fill: 'rgba(0,0,0,0.30)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={yAxisW}
            hide={!config.showYAxis}
            /* interval={0} forces Recharts to render every tick label instead of
               auto-hiding "overlapping" ones (which it tends to over-estimate). */
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
          />
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
          <Bar dataKey="percentage" radius={[0, config.barRadius, config.barRadius, 0]} barSize={18}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} fillOpacity={config.barOpacity} />
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
