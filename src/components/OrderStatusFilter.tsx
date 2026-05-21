'use client';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_OPTIONS } from '@/types';
import type { OrderStatus } from '@/types';

interface Props { value: OrderStatus; onChange: (v: OrderStatus) => void; }

export function OrderStatusFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[12px] text-black/40 flex-shrink-0">订单状态</span>
      <div className="flex items-center gap-0.5 glass-card-subtle p-1 rounded-ios flex-wrap">
        {ORDER_STATUS_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={cn('px-2.5 py-1 rounded-[7px] text-[12px] font-500 transition-all no-tap whitespace-nowrap',
              value === opt.value ? 'bg-white shadow-ios-sm' : 'text-black/40 hover:text-black/60')}
            style={value === opt.value ? { color: opt.color } : {}}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
