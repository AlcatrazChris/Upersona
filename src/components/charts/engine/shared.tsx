import type { ChartDataItem } from './types';
import type { ChartConfig, LabelType } from '@/lib/chartConfig';

// Keeps the first topN items (by existing order) and aggregates the rest as "其他".
export function applyTopN(data: ChartDataItem[], topN: number | undefined): ChartDataItem[] {
  if (!topN || topN <= 0 || data.length <= topN) return data;
  const top  = data.slice(0, topN);
  const rest = data.slice(topN);
  const othersCount = rest.reduce((s, d) => s + d.count, 0);
  const othersPct   = parseFloat(rest.reduce((s, d) => s + d.percentage, 0).toFixed(1));
  return [...top, { label: '其他', count: othersCount, percentage: othersPct }];
}

export function ChartTooltip({
  active, payload, isMultiSelect, totalSamples,
}: {
  active?: boolean;
  payload?: { payload: ChartDataItem }[];
  isMultiSelect?: boolean;
  totalSamples?: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-300 px-3 py-2 text-[11px] min-w-[130px] pointer-events-none" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>
      <div className="font-medium text-gray-800 mb-1 leading-tight">{d.label}</div>
      <div className="flex items-baseline gap-2">
        <span className="tabular-nums font-semibold" style={{ color: '#003087' }}>{d.percentage.toFixed(1)}%</span>
        <span className="text-gray-400 tabular-nums">{d.count.toLocaleString()} 人</span>
      </div>
      {isMultiSelect && totalSamples != null && (
        <div className="text-gray-400 text-[10px] mt-0.5 tabular-nums">
          总样本 {totalSamples.toLocaleString()} 人
        </div>
      )}
    </div>
  );
}

const RADIAN = Math.PI / 180;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PieSliceLabel(props: any) {
  const {
    cx, cy, midAngle, innerRadius, outerRadius,
    percentage, count, showLabel, labelType,
  } = props as {
    cx: number; cy: number; midAngle: number;
    innerRadius: number; outerRadius: number;
    percentage: number; count: number;
    showLabel: boolean; labelType: LabelType;
  };
  if (!showLabel || percentage < 4) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const text = labelType === 'count' ? `${count}` : `${percentage.toFixed(0)}%`;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}>
      {text}
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BarLabelContent(props: any & { items: ChartDataItem[]; labelType: LabelType; fontSize: number }) {
  const { x, y, width, height, value, index, items, labelType, fontSize } = props as {
    x: number; y: number; width: number; height: number;
    value: number; index: number;
    items: ChartDataItem[]; labelType: LabelType; fontSize: number;
  };
  const item = items[index];
  if (!item || x == null || y == null) return null;
  const lx = x + width + 6;
  const ly = y + height / 2 + 1;
  let text = '';
  if (labelType === 'pct')   text = `${Number(value).toFixed(1)}%`;
  if (labelType === 'count') text = `${item.count}`;
  if (labelType === 'both')  text = `${Number(value).toFixed(1)}% / ${item.count}`;
  return (
    <text x={lx} y={ly} dominantBaseline="middle"
      style={{ fontSize, fill: 'rgba(0,0,0,0.62)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
      {text}
    </text>
  );
}

export function cfgLabelRight(config: ChartConfig) {
  return config.showLabel ? 52 : 10;
}
