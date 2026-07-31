'use client';

import { useMemo, useState } from 'react';
import { CalendarRange, RotateCcw } from 'lucide-react';
import type { Dataset } from '@/types/dataSchema';
import { useDatasetStore } from '@/store/datasetStore';
import { detectTimeField, getDefaultDateBlocks, recordDate, type DateBlock } from '@/lib/timeStatus';

function splitRange(start: string, end: string, count: number): DateBlock[] {
  const first = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  const days = Math.floor((last.getTime() - first.getTime()) / 86400000) + 1;
  return Array.from({ length: Math.min(count, days) }, (_, index) => {
    const from = new Date(first);
    const to = new Date(first);
    from.setDate(from.getDate() + Math.floor(days * index / count));
    to.setDate(to.getDate() + Math.floor(days * (index + 1) / count) - 1);
    return {
      key: `date_block_${index + 1}`,
      label: `时间段 ${index + 1}`,
      start: from.toISOString().slice(0, 10),
      end: to.toISOString().slice(0, 10),
    };
  });
}

export function DateBlockEditor({ dataset }: { dataset: Dataset }) {
  const { viewConfigs, updateViewConfig } = useDatasetStore();
  const timeField = useMemo(() => detectTimeField(dataset), [dataset]);
  const defaults = useMemo(() => timeField ? getDefaultDateBlocks(dataset, timeField) : [], [dataset, timeField]);
  const dates = useMemo(() => timeField
    ? dataset.records.map(record => recordDate(record[timeField.key])).filter((date): date is Date => !!date)
    : [], [dataset.records, timeField]);
  const min = dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))).toISOString().slice(0, 10) : '';
  const max = dates.length ? new Date(Math.max(...dates.map(date => date.getTime()))).toISOString().slice(0, 10) : '';
  const saved = viewConfigs[dataset.id]?.dateBlocks;
  const blocks = saved?.length ? saved : defaults;
  const [count, setCount] = useState(Math.max(1, blocks.length));
  const save = (next: DateBlock[]) => updateViewConfig(dataset.id, { dateBlocks: next });
  const update = (index: number, patch: Partial<DateBlock>) =>
    save(blocks.map((block, current) => current === index ? { ...block, ...patch } : block));

  if (!timeField || !min || !max) {
    return <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">未识别到可用的日期字段</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <CalendarRange size={15} className="text-blue-500" /> 时间分块
            </div>
            <p className="mt-1 text-xs text-gray-400">日期字段：{timeField.name} · 数据范围 {min} 至 {max}</p>
          </div>
          <button type="button" onClick={() => { save(defaults); setCount(defaults.length); }}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
            <RotateCcw size={12} /> 恢复按月份分
          </button>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 p-4">
          <label className="text-xs text-gray-500">分块数量
            <input type="number" min={1} max={24} value={count}
              onChange={event => setCount(Math.max(1, Math.min(24, Number(event.target.value) || 1)))}
              className="mt-1 block w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </label>
          <button type="button" onClick={() => save(splitRange(min, max, count))}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
            按日期范围等分
          </button>
          <span className="pb-2 text-[11px] text-gray-400">生成后可单独修改每块的日期与名称</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {blocks.map((block, index) => (
          <div key={block.key} className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">分块 {index + 1}</div>
            <input value={block.label} onChange={event => update(index, { label: event.target.value })}
              aria-label={`分块 ${index + 1} 名称`}
              className="w-full border-0 border-b border-gray-100 px-0 pb-2 text-sm font-semibold text-gray-800 outline-none focus:border-blue-400" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-[11px] text-gray-400">开始日期
                <input type="date" value={block.start} min={min} max={block.end}
                  onChange={event => update(index, { start: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700" />
              </label>
              <label className="text-[11px] text-gray-400">结束日期
                <input type="date" value={block.end} min={block.start} max={max}
                  onChange={event => update(index, { end: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700" />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
