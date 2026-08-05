'use client';

import { cn } from '@/lib/utils';
import { ALL_STATUS, monthLabel } from '@/lib/timeStatus';

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
  orderOptions,
  selectedOrders,
  onOrdersChange,
  monthOptions,
  selectedMonths,
  onMonthsChange,
  monthLabels,
}: {
  orderOptions: string[];
  selectedOrders: string[];
  onOrdersChange: (values: string[]) => void;
  monthOptions: string[];
  selectedMonths: string[];
  onMonthsChange: (values: string[]) => void;
  monthLabels?: Record<string, string>;
}) {
  return (
    <>
      <StatusGroup
        label="订单状态"
        options={orderOptions}
        selected={selectedOrders}
        onChange={onOrdersChange}
      />
      <StatusGroup
        label="时间状态"
        options={monthOptions}
        selected={selectedMonths}
        onChange={onMonthsChange}
        format={value => monthLabels?.[value] ?? monthLabel(value)}
      />
    </>
  );
}
