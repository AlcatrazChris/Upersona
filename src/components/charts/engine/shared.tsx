import type { ChartDataItem } from './types';
import type { ChartConfig, LabelType } from '@/lib/chartConfig';

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
    <div className="bg-white rounded-xl border border-gray-100 shadow-xl px-3 py-2.5 text-[12px] min-w-[140px] pointer-events-none">
      <div className="font-semibold text-black/80 mb-1">{d.label}</div>
      <div className="text-black/55">{d.count.toLocaleString()} 人</div>
      <div className="text-black/40">{d.percentage.toFixed(1)}%</div>
      {isMultiSelect && totalSamples != null && (
        <div className="text-black/28 text-[10px] mt-0.5">
          总样本：{totalSamples.toLocaleString()} 人
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
      style={{ fontSize, fill: 'rgba(0,0,0,0.42)', fontWeight: 500, pointerEvents: 'none' }}>
      {text}
    </text>
  );
}

export function cfgLabelRight(config: ChartConfig) {
  return config.showLabel ? 52 : 10;
}
