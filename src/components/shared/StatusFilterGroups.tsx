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
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <button
        type="button"
        onClick={() => onChange([ALL_STATUS])}
        className={cn(
          'text-xs px-3 py-1 rounded-full transition-all border',
          all
            ? 'bg-gray-800 border-gray-800 text-white font-medium'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100',
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
              'text-xs px-3 py-1 rounded-full transition-all border',
              active
                ? 'bg-blue-600 border-blue-600 text-white font-medium'
                : 'bg-blue-50 border-blue-100 text-blue-600 hover:border-blue-300',
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
