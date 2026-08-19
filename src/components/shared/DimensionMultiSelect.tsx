'use client';

import { useState } from 'react';
import { Check, ChevronDown, GripVertical, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Field } from '@/types/dataSchema';

export function DimensionMultiSelect({
  fields,
  categories,
  selectedKeys,
  availableKeys,
  onToggle,
  onReorder,
}: {
  fields: Field[];
  categories: Array<{ key: string; label: string; fields: Field[] }>;
  selectedKeys: string[];
  availableKeys: Set<string> | null;
  onToggle: (key: string) => void;
  onReorder: (fromKey: string, toKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const selectedFields = selectedKeys
    .map(key => fields.find(field => field.key === key))
    .filter((field): field is Field => !!field);
  const visibleCategories = categories
    .map(category => ({
      ...category,
      fields: category.fields.filter(field =>
        !search || field.name.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter(category => category.fields.length > 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex min-w-[180px] items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300"
      >
        <span>{selectedKeys.length > 0 ? `已选择 ${selectedKeys.length} 个维度` : '选择对比维度'}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-50 flex max-h-[460px] min-w-[340px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search size={12} className="text-gray-400" />
              <input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索维度…" className="w-full bg-transparent text-xs outline-none placeholder:text-gray-300" />
            </div>
            <div className="overflow-y-auto py-1">
              {selectedFields.length > 0 && !search && (
                <div className="border-b border-gray-100 px-2 pb-2">
                  <div className="px-1 py-2 text-[11px] font-medium text-gray-400">图表顺序 · 拖动调整</div>
                  {selectedFields.map((field, index) => (
                    <div
                      key={field.key}
                      draggable
                      onDragStart={() => setDraggingKey(field.key)}
                      onDragOver={event => event.preventDefault()}
                      onDrop={() => {
                        if (draggingKey) onReorder(draggingKey, field.key);
                        setDraggingKey(null);
                      }}
                      onDragEnd={() => setDraggingKey(null)}
                      className={cn('flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 active:cursor-grabbing', draggingKey === field.key && 'bg-blue-50 opacity-60')}
                    >
                      <GripVertical size={13} className="text-gray-300" />
                      <span className="w-5 text-right tabular-nums text-gray-400">{index + 1}</span>
                      <span className="flex-1 truncate">{field.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {visibleCategories.map(category => (
                <div key={category.key} className="py-1">
                  <div className="sticky top-0 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-gray-400 backdrop-blur-sm">{category.label}</div>
                  {category.fields.map(field => {
                    const available = !availableKeys || availableKeys.has(field.key);
                    const selected = selectedKeys.includes(field.key);
                    return (
                      <button type="button" key={field.key} disabled={!available} onClick={() => available && onToggle(field.key)} className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-xs', available ? 'text-gray-700 hover:bg-blue-50' : 'cursor-not-allowed text-gray-300')}>
                        <span className={cn('flex h-4 w-4 items-center justify-center rounded border', selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white')}>
                          {selected && <Check size={11} />}
                        </span>
                        <span className="flex-1 truncate">{field.name}</span>
                        {!available && <span className="text-[10px]">对比数据集缺失</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
              <span>可连续勾选多个维度</span>
              <button type="button" onClick={() => setOpen(false)} className="text-blue-600">完成</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
