import { useEffect, useRef, useState } from 'react';
import type { ChartDataItem } from './types';
import type { ChartConfig, LabelType } from '@/lib/chartConfig';
import { cn } from '@/lib/utils';

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: '条形',
  pie: '饼图',
  donut: '环形',
  line: '折线',
  area: '面积',
  lollipop: '棒棒糖',
  waffle: '华夫图',
  grouped: '簇状',
  stacked: '堆积',
};

export function ChartTypeSwitcher<T extends string>({
  value,
  options,
  onChange,
  labels = CHART_TYPE_LABELS,
  className,
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  labels?: Record<string, string>;
  className?: string;
}) {
  return (
    <div role="group" aria-label="图表类型" className={cn('flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5', className)}>
      {options.map(option => (
        <button
          type="button"
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'whitespace-nowrap rounded-md px-2 py-1 text-xs transition-all',
            value === option
              ? 'bg-white text-gray-800 shadow-sm font-medium'
              : 'text-gray-600 hover:text-gray-900',
          )}
        >
          {labels[option] ?? option}
        </button>
      ))}
    </div>
  );
}

export function useResizableChartHeight(baseHeight: number, minHeight = 120) {
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const height = manualHeight ?? baseHeight;
  const resizeRef = useRef<{ y: number; height: number } | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => () => cleanupRef.current(), []);

  const onResizeStart = (event: React.MouseEvent) => {
    event.preventDefault();
    cleanupRef.current();
    resizeRef.current = { y: event.clientY, height };
    const onMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      setManualHeight(Math.max(
        minHeight,
        resizeRef.current.height + moveEvent.clientY - resizeRef.current.y,
      ));
    };
    const cleanup = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', cleanup);
      cleanupRef.current = () => {};
    };
    cleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', cleanup);
  };

  const onResizeKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Home') {
      event.preventDefault();
      setManualHeight(null);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      setManualHeight(Math.max(minHeight, height + direction * 20));
    }
  };

  return { height, onResizeStart, onResizeKeyDown, resetHeight: () => setManualHeight(null) };
}

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
    <div className="pointer-events-none min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="mb-1.5 text-xs font-semibold leading-tight text-slate-900">{d.label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tabular-nums text-blue-700">{d.percentage.toFixed(1)}%</span>
        <span className="text-xs text-slate-500 tabular-nums">{d.count.toLocaleString()} 人</span>
      </div>
      {isMultiSelect && totalSamples != null && (
        <div className="mt-1 text-xs text-slate-500 tabular-nums">
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
