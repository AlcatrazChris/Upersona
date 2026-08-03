'use client';

import { getColors } from '@/lib/chartConfig';
import type { ChartConfig } from '@/lib/chartConfig';
import { summarizeBoxPlot } from '@/lib/boxPlot';

function format(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : Number(value.toFixed(2)).toLocaleString();
}

export function BoxPlotEngine({ values, config, height }: {
  values: number[];
  config: ChartConfig;
  height?: number;
}) {
  const summary = summarizeBoxPlot(values);
  if (!summary) return null;
  const { min, q1, median, q3, max, count } = summary;
  const range = max - min || 1;
  const x = (value: number) => 70 + ((value - min) / range) * 660;
  const color = getColors(config.colorScheme)[0];
  const chartHeight = Math.max(180, height ?? config.chartHeight ?? 240);

  return (
    <div style={{ height: chartHeight }} className="w-full">
      <svg viewBox="0 0 800 190" className="h-full w-full" role="img" aria-label={`箱型图，中位数 ${format(median)}`}>
        <line x1={x(min)} y1="90" x2={x(max)} y2="90" stroke="#94a3b8" strokeWidth="2" />
        <line x1={x(min)} y1="65" x2={x(min)} y2="115" stroke="#64748b" strokeWidth="2" />
        <line x1={x(max)} y1="65" x2={x(max)} y2="115" stroke="#64748b" strokeWidth="2" />
        <rect x={x(q1)} y="45" width={Math.max(2, x(q3) - x(q1))} height="90" rx="8" fill={color} fillOpacity={config.barOpacity} />
        <line x1={x(median)} y1="45" x2={x(median)} y2="135" stroke="white" strokeWidth="4" />
        {config.showLabel && [
          ['最小值', min], ['Q1', q1], ['中位数', median], ['Q3', q3], ['最大值', max],
        ].map(([label, value], index) => (
          <g key={String(label)} transform={`translate(${x(Number(value))},${index % 2 ? 165 : 25})`}>
            <text textAnchor="middle" fontSize={config.labelFontSize} fill="#475569">
              {label} {format(Number(value))}
            </text>
          </g>
        ))}
        {config.showSampleCount && <text x="730" y="180" textAnchor="end" fontSize="11" fill="#94a3b8">n={count.toLocaleString()}</text>}
      </svg>
    </div>
  );
}
