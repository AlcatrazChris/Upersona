import { useEffect, useRef, useState } from 'react';
import type { ChartDataItem } from './types';
import type { ChartConfig, LabelType } from '@/lib/chartConfig';
import { clampYAxisWidth } from '@/lib/chartLayout';
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

export function useResizableYAxisWidth(baseWidth: number, minWidth = 64, maxWidth = 320) {
  const [manualWidth, setManualWidth] = useState<number | null>(null);
  const width = clampYAxisWidth(manualWidth ?? baseWidth, minWidth, maxWidth);
  const dragRef = useRef<{ x: number; width: number } | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => () => cleanupRef.current(), []);

  const onResizeStart = (event: React.MouseEvent) => {
    event.preventDefault();
    cleanupRef.current();
    dragRef.current = { x: event.clientX, width };
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      setManualWidth(clampYAxisWidth(
        dragRef.current.width + moveEvent.clientX - dragRef.current.x,
        minWidth,
        maxWidth,
      ));
    };
    const cleanup = () => {
      dragRef.current = null;
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
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
      setManualWidth(null);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setManualWidth(clampYAxisWidth(
        width + (event.key === 'ArrowRight' ? 12 : -12),
        minWidth,
        maxWidth,
      ));
    }
  };

  return { width, onResizeStart, onResizeKeyDown, resetWidth: () => setManualWidth(null) };
}

export function YAxisResizeHandle({
  width, offset = 0, minWidth = 64, maxWidth = 320,
  onResizeStart, onResizeKeyDown, onReset,
}: {
  width: number;
  offset?: number;
  minWidth?: number;
  maxWidth?: number;
  onResizeStart: (event: React.MouseEvent) => void;
  onResizeKeyDown: (event: React.KeyboardEvent) => void;
  onReset: () => void;
}) {
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label="调整 Y 轴标签宽度"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={Math.round(width)}
      title="拖动调整 Y 轴宽度；双击恢复默认"
      onMouseDown={onResizeStart}
      onKeyDown={onResizeKeyDown}
      onDoubleClick={onReset}
      className="group absolute inset-y-2 z-10 w-3 -translate-x-1/2 cursor-col-resize outline-none"
      style={{ left: width + offset }}
    >
      <span className="absolute inset-y-0 left-1/2 w-px bg-slate-200 transition-colors group-hover:bg-blue-400 group-focus:bg-blue-500" />
      <span className="absolute left-1/2 top-1/2 h-8 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white shadow-sm transition-colors group-hover:border-blue-400 group-focus:border-blue-500" />
    </div>
  );
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
    percentage, count, showLabel, labelType, decimalPlaces = 0, valuePrefix = '', valueSuffix = '', showZeroLabels = false,
  } = props as {
    cx: number; cy: number; midAngle: number;
    innerRadius: number; outerRadius: number;
    percentage: number; count: number;
    showLabel: boolean; labelType: LabelType; decimalPlaces?: number; valuePrefix?: string; valueSuffix?: string; showZeroLabels?: boolean;
  };
  if (!showLabel || (!showZeroLabels && percentage === 0) || percentage < 4) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const value = labelType === 'count' ? `${count}` : `${percentage.toFixed(decimalPlaces)}%`;
  const text = `${valuePrefix}${value}${valueSuffix}`;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}>
      {text}
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BarLabelContent(props: any & { items: ChartDataItem[]; labelType: LabelType; fontSize: number }) {
  const { x, y, width, height, value, index, items, labelType, fontSize, decimalPlaces = 0, valuePrefix = '', valueSuffix = '', showZeroLabels = false } = props as {
    x: number; y: number; width: number; height: number;
    value: number; index: number;
    items: ChartDataItem[]; labelType: LabelType; fontSize: number; decimalPlaces?: number; valuePrefix?: string; valueSuffix?: string; showZeroLabels?: boolean;
  };
  const item = items[index];
  if (!item || x == null || y == null) return null;
  if (!showZeroLabels && Number(value) === 0) return null;
  const lx = x + width + 6;
  const ly = y + height / 2 + 1;
  let text = '';
  if (labelType === 'pct')   text = `${Number(value).toFixed(decimalPlaces)}%`;
  if (labelType === 'count') text = `${item.count}`;
  if (labelType === 'both')  text = `${Number(value).toFixed(decimalPlaces)}% / ${item.count}`;
  text = `${valuePrefix}${text}${valueSuffix}`;
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
