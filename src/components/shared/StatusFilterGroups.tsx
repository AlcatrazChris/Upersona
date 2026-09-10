'use client';

import { cn } from '@/lib/utils';
import { ALL_STATUS, monthLabel } from '@/lib/timeStatus';
import { useDatasetStore } from '@/store/datasetStore';
import type { ViewConfig } from '@/lib/viewConfig';

function StatusGroup({
  label,
  options,
  selected,
  onChange,
  format = value => value,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  format?: (value: string) => string;
}) {
  if (options.length === 0) return null;
  const all = selected.includes(ALL_STATUS) || selected.length === 0;
  const toggle = (value: string) => {
    const current = selected.filter(item => item !== ALL_STATUS);
    const next = current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value];
    onChange(next.length > 0 ? next : [ALL_STATUS]);
  };
  return (
    <div className="flex min-h-8 items-center gap-2 flex-wrap">
      <span className="w-16 flex-shrink-0 text-xs text-slate-400">{label}</span>
      <button
        type="button"
        onClick={() => onChange([ALL_STATUS])}
        className={cn(
          'rounded-lg border px-3 py-1 text-xs transition-all',
          all
            ? 'border-slate-800 bg-slate-800 font-medium text-white'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
        )}
      >
        全部
      </button>
      {options.map(option => {
        const active = !all && selected.includes(option);
        return (
          <button
            type="button"
            key={option}
            onClick={() => toggle(option)}
            className={cn(
              'rounded-lg border px-3 py-1 text-xs transition-all',
              active
                ? 'bg-blue-600 border-blue-600 text-white font-medium'
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600',
            )}
          >
            {format(option)}
          </button>
        );
      })}
    </div>
  );
}

export function StatusFilterGroups({
  datasetId,
  viewConfig,
  onStatusVariableChange,
  orderOptions,
  selectedOrders,
  onOrdersChange,
  monthOptions,
  selectedMonths,
  onMonthsChange,
  monthLabels,
  orderLabel = '订单状态',
  monthLabelText = '时间状态',
}: {
  datasetId: string;
  viewConfig: ViewConfig;
  onStatusVariableChange?: () => void;
  orderOptions: string[];
  selectedOrders: string[];
  onOrdersChange: (values: string[]) => void;
  monthOptions: string[];
  selectedMonths: string[];
  onMonthsChange: (values: string[]) => void;
  monthLabels?: Record<string, string>;
  orderLabel?: string;
  monthLabelText?: string;
}) {
  const updateViewConfig = useDatasetStore(state => state.updateViewConfig);
  const variables = (viewConfig.statusVariables ?? []).filter(variable => variable.fieldKey);
  const activeId = viewConfig.activeStatusVariableId ?? variables[0]?.id;
  const variableName = (name: string, index: number) => name.trim() || `\u72b6\u6001\u53d8\u91cf ${index + 1}`;

  const selectVariable = (id: string) => {
    const selected = variables.find(item => item.id === id);
    if (!selected) return;
    const index = variables.findIndex(item => item.id === id);
    updateViewConfig(datasetId, {
      activeStatusVariableId: selected.id,
      statusVariableName: variableName(selected.name, index),
      statusFieldKey: selected.fieldKey,
      statusGroups: selected.groups,
    });
    onStatusVariableChange?.();
  };

  return (
    <>
      {variables.length > 1 && <label className="flex min-h-8 items-center gap-2 text-xs text-slate-600">
        <span className="w-16 flex-shrink-0 text-slate-500">{'\u72b6\u6001\u53d8\u91cf'}</span>
        <select
          value={activeId}
          onChange={event => selectVariable(event.target.value)}
          className="h-8 min-w-40 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]"
          aria-label={'\u9009\u62e9\u72b6\u6001\u53d8\u91cf'}
        >
          {variables.map((variable, index) => <option key={variable.id} value={variable.id}>{variableName(variable.name, index)}</option>)}
        </select>
      </label>}
      <StatusGroup
        label={orderLabel}
        options={orderOptions}
        selected={selectedOrders}
        onChange={onOrdersChange}
      />
      <StatusGroup
        label={monthLabelText}
        options={monthOptions}
        selected={selectedMonths}
        onChange={onMonthsChange}
        format={value => monthLabels?.[value] ?? monthLabel(value)}
      />
    </>
  );
}
