'use client';

import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { aggregateField } from '@/lib/dataAggregator';
import { getColors } from '@/lib/chartConfig';
import type { ChartConfig } from '@/lib/chartConfig';
import type { Dataset, Field } from '@/types/dataSchema';
import type {
  DifferencePoint, DumbbellPoint, HeatmapCell, HistogramBin,
  PersonaChartSpec, ScatterPoint,
} from '@/lib/personaTemplate';

interface Props {
  dataset: Dataset;
  field: Field;
  records: Record<string, unknown>[];
  baselineRecords: Record<string, unknown>[];
  spec: PersonaChartSpec;
  config: ChartConfig;
  height: number;
}

function numberValues(records: Record<string, unknown>[], key: string) {
  return records.map(record => Number(record[key])).filter(Number.isFinite);
}

function histogram(records: Record<string, unknown>[], key: string, requestedBins = 8): HistogramBin[] {
  const values = numberValues(records, key);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.max(4, Math.min(20, requestedBins));
  const width = max === min ? 1 : (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min + index * width;
    const end = index === binCount - 1 ? max : start + width;
    return { range: `${start.toFixed(1)}–${end.toFixed(1)}`, start, end, count: 0 };
  });
  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor((value - min) / width));
    bins[index].count += 1;
  }
  return bins;
}

function scatter(records: Record<string, unknown>[], xKey: string, yKey: string): ScatterPoint[] {
  return records.flatMap(record => {
    const x = Number(record[xKey]);
    const y = Number(record[yKey]);
    return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y }] : [];
  }).slice(0, 1000);
}

function dumbbell(records: Record<string, unknown>[], field: Field, startKey: string, endKey: string): DumbbellPoint[] {
  const groups = new Map<string, { start: number[]; end: number[] }>();
  for (const record of records) {
    const label = String(record[field.key] ?? '').trim();
    const start = Number(record[startKey]);
    const end = Number(record[endKey]);
    if (!label || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    const group = groups.get(label) ?? { start: [], end: [] };
    group.start.push(start); group.end.push(end); groups.set(label, group);
  }
  const result = [...groups.entries()].map(([label, values]) => ({
    label,
    start: values.start.reduce((sum, value) => sum + value, 0) / values.start.length,
    end: values.end.reduce((sum, value) => sum + value, 0) / values.end.length,
  }));
  return (field.isOrdered && field.orderedValues?.length
    ? result.sort((a, b) => {
        const ai = field.orderedValues!.indexOf(a.label);
        const bi = field.orderedValues!.indexOf(b.label);
        return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
      })
    : result.sort((a, b) => Math.abs(b.end - b.start) - Math.abs(a.end - a.start))).slice(0, 10);
}

function difference(records: Record<string, unknown>[], baseline: Record<string, unknown>[], field: Field): DifferencePoint[] {
  const current = aggregateField(records, field);
  const base = new Map(aggregateField(baseline, field).map(item => [item.label, item.percentage]));
  const result = current.map(item => ({
    label: item.label,
    value: item.percentage,
    baseline: base.get(item.label) ?? 0,
    delta: item.percentage - (base.get(item.label) ?? 0),
  }));
  return (field.isOrdered && field.orderedValues?.length
    ? result
    : result.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))).slice(0, 10);
}

function heatmap(records: Record<string, unknown>[], rowKey: string, columnKey: string, valueKey?: string): HeatmapCell[] {
  const groups = new Map<string, { total: number; count: number }>();
  for (const record of records) {
    const row = String(record[rowKey] ?? '').trim();
    const column = String(record[columnKey] ?? '').trim();
    if (!row || !column) continue;
    const key = `${row}\u0000${column}`;
    const value = valueKey ? Number(record[valueKey]) : 1;
    if (!Number.isFinite(value)) continue;
    const group = groups.get(key) ?? { total: 0, count: 0 };
    group.total += value;
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [row, column] = key.split('\u0000');
    return { row, column, value: valueKey ? group.total / group.count : group.count };
  });
}

export function AdvancedPersonaChartEngine({ dataset, field, records, baselineRecords, spec, config, height }: Props) {
  const colors = getColors(config.colorScheme);
  const color = colors[0];
  const secondary = spec.secondaryFieldKey
    ? dataset.fields.find(item => item.key === spec.secondaryFieldKey)
    : undefined;
  const endField = spec.endFieldKey
    ? dataset.fields.find(item => item.key === spec.endFieldKey)
    : undefined;

  const data = useMemo(() => {
    if (spec.type === 'histogram') return histogram(records, field.key, spec.bins);
    if (spec.type === 'scatter' && secondary) return scatter(records, field.key, secondary.key);
    if (spec.type === 'dumbbell' && secondary && endField) return dumbbell(records, field, secondary.key, endField.key);
    if (spec.type === 'difference') return difference(records, baselineRecords, field);
    if (spec.type === 'heatmap' && secondary) {
      return heatmap(records, field.key, secondary.key, spec.valueFieldKey);
    }
    return [];
  }, [baselineRecords, endField, field, records, secondary, spec]);

  if (!data.length) {
    return <div className="flex min-h-60 items-center justify-center rounded-lg bg-slate-50 px-6 text-center text-sm text-slate-500">请在画像模板中配置适用的关联字段。</div>;
  }

  if (spec.type === 'scatter') {
    return <div style={{ height }}><ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 12, right: 16, bottom: 18, left: 0 }}>
        {config.showGrid && <CartesianGrid stroke="#e2e8f0" />}
        <XAxis type="number" dataKey="x" name={field.name} hide={!config.showXAxis} tick={{ fontSize: config.axisFontSize }} />
        <YAxis type="number" dataKey="y" name={secondary?.name} hide={!config.showYAxis} tick={{ fontSize: config.axisFontSize }} />
        {config.showTooltip && <Tooltip cursor={{ strokeDasharray: '3 3' }} />}
        <Scatter data={data as ScatterPoint[]} fill={color} fillOpacity={Math.min(.8, config.barOpacity)} />
      </ScatterChart>
    </ResponsiveContainer></div>;
  }

  if (spec.type === 'histogram') {
    return <div style={{ height }}><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data as HistogramBin[]} margin={{ top: 12, right: 8, bottom: 24, left: 0 }}>
        {config.showGrid && <CartesianGrid stroke="#e2e8f0" vertical={false} />}
        <XAxis dataKey="range" hide={!config.showXAxis} tick={{ fontSize: config.axisFontSize }} interval="preserveStartEnd" />
        <YAxis hide={!config.showYAxis} tick={{ fontSize: config.axisFontSize }} />
        {config.showTooltip && <Tooltip />}
        <Bar dataKey="count" fill={color} fillOpacity={config.barOpacity}>
          {config.showLabel && <LabelList dataKey="count" position="top" fontSize={config.labelFontSize} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>;
  }

  if (spec.type === 'difference') {
    const visible = (data as DifferencePoint[]).slice(0, config.topN || undefined);
    return <div className={config.compact ? 'space-y-2' : 'space-y-3'} style={{ minHeight: height }}>
      {visible.map(item => (
        <div key={item.label} className="grid grid-cols-[minmax(100px,1fr)_2fr_64px] items-center gap-3 text-xs">
          <span className="truncate text-slate-600" style={{ fontSize: config.labelFontSize }}>{config.showLabel ? item.label : ''}</span>
          <div className="relative h-2 rounded bg-slate-100">
            <span className="absolute inset-y-[-3px] w-px bg-slate-500" style={{ left: `${Math.min(100, item.baseline)}%` }} />
            <span className="block h-2 rounded" style={{ width: `${Math.min(100, item.value)}%`, backgroundColor: color, opacity: config.barOpacity }} />
          </div>
          <span className={`text-right font-semibold tabular-nums ${item.delta >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{config.showLabel ? `${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(1)}pp` : ''}</span>
        </div>
      ))}
    </div>;
  }

  if (spec.type === 'dumbbell') {
    const visible = (data as DumbbellPoint[]).slice(0, config.topN || undefined);
    const values = visible.flatMap(item => [item.start, item.end]);
    const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
    return <div className={config.compact ? 'space-y-2' : 'space-y-3'} style={{ minHeight: height }}>
      {visible.map(item => {
        const start = (item.start - min) / span * 100; const end = (item.end - min) / span * 100;
        return <div key={item.label} className="grid grid-cols-[minmax(100px,1fr)_2fr] items-center gap-3 text-xs">
          <span className="truncate text-slate-600" style={{ fontSize: config.labelFontSize }}>{config.showLabel ? item.label : ''}</span>
          <div className="relative h-5">
            <span className="absolute top-2 h-0.5 bg-slate-300" style={{ left: `${Math.min(start, end)}%`, width: `${Math.abs(end - start)}%` }} />
            <span className="absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-slate-500" style={{ left: `${start}%` }} title={config.showTooltip ? `${secondary?.name}: ${item.start.toFixed(1)}` : undefined} />
            <span className="absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full" style={{ left: `${end}%`, backgroundColor: color, opacity: config.barOpacity }} title={config.showTooltip ? `${endField?.name}: ${item.end.toFixed(1)}` : undefined} />
          </div>
        </div>;
      })}
    </div>;
  }

  const cells = data as HeatmapCell[];
  const limit = config.topN || 10;
  const rows = [...new Set(cells.map(cell => cell.row))].slice(0, limit);
  const columns = [...new Set(cells.map(cell => cell.column))].slice(0, limit);
  const max = Math.max(...cells.map(cell => cell.value), 1);
  return <div className="overflow-x-auto" style={{ minHeight: height }}>
    <table className="w-full border-separate border-spacing-1 text-xs" style={{ fontSize: config.labelFontSize }}>
      <thead><tr><th /><>{columns.map(column => <th key={column} className="px-2 py-1 text-slate-500">{column}</th>)}</></tr></thead>
      <tbody>{rows.map(row => <tr key={row}>
        <th className="whitespace-nowrap px-2 text-left font-medium text-slate-600">{row}</th>
        {columns.map(column => {
          const value = cells.find(cell => cell.row === row && cell.column === column)?.value ?? 0;
          return <td key={column} className="rounded px-2 py-2 text-center tabular-nums" style={{
            background: `rgba(37,99,235,${value ? .08 + value / max * .82 : .03})`,
            color: value / max > .55 ? 'white' : '#334155',
          }}>{config.showLabel ? value : ''}</td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}
