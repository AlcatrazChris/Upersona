'use client';

import { useState } from 'react';
import { GripVertical, Sparkles, ArrowUpDown, RotateCcw, X } from 'lucide-react';
import type { Field } from '@/types/dataSchema';

interface Props {
  field: Field;
  onClose: () => void;
  onSave: (isOrdered: boolean, orderedValues: string[]) => void;
}

export function ManualOrderModal({ field, onClose, onSave }: Props) {
  // options can be undefined if dataset was loaded from cloud without recomputing;
  // fall back to topValues (count-sorted) or orderedValues as last resort
  const original =
    (field.options?.length ? field.options : null) ??
    field.statistics?.topValues?.map(v => v.value) ??
    field.orderedValues ??
    [];
  const initial  = field.orderedValues?.length ? field.orderedValues : original;
  const [items,   setItems]   = useState<string[]>(initial);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  // ── Drag handlers ──────────────────────────────────────────
  function startDrag(i: number) { setDragIdx(i); }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx !== null && i !== dragIdx) setOverIdx(i);
  }

  function drop(i: number) {
    if (dragIdx === null || dragIdx === i) { reset(); return; }
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setItems(next);
    reset();
  }

  function reset() { setDragIdx(null); setOverIdx(null); }

  // ── AI suggestion ──────────────────────────────────────────
  async function runAI() {
    setAiStatus('loading');
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldName: field.name, values: original }),
      });
      const data: { isOrdered: boolean; orderedValues?: string[]; error?: string } = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.isOrdered && data.orderedValues?.length) setItems(data.orderedValues);
      setAiStatus('idle');
    } catch {
      setAiStatus('error');
      setTimeout(() => setAiStatus('idle'), 3000);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">排列顺序 · {field.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">拖拽调整；列表顶部 = 图表顶部</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-0.5 -mr-0.5 -mt-0.5">
            <X size={15} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-gray-50 flex-shrink-0">
          <button
            onClick={runAI}
            disabled={aiStatus === 'loading'}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            {aiStatus === 'loading'
              ? <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
              : <Sparkles size={11} />}
            {aiStatus === 'error' ? 'AI失败' : 'AI建议'}
          </button>
          <button
            onClick={() => setItems(p => [...p].reverse())}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowUpDown size={11} /> 反转
          </button>
          <button
            onClick={() => setItems(original)}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            title="还原为按数量排序的原始顺序"
          >
            <RotateCcw size={11} /> 重置
          </button>
          {field.isOrdered && (
            <button
              onClick={() => { onSave(false, []); onClose(); }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
              title="清除自定义排序，恢复按数量默认顺序"
            >
              清除排序
            </button>
          )}
        </div>

        {/* Draggable list */}
        <div className="overflow-y-auto flex-1 py-1">
          {items.map((item, i) => (
            <div
              key={item}
              draggable
              onDragStart={() => startDrag(i)}
              onDragOver={e => onDragOver(e, i)}
              onDrop={() => drop(i)}
              onDragEnd={reset}
              className={[
                'flex items-center gap-2 px-5 py-2 cursor-grab active:cursor-grabbing select-none transition-colors',
                dragIdx === i   ? 'opacity-30 bg-gray-50' : '',
                overIdx === i   ? 'bg-indigo-50 border-t-2 border-indigo-300' : 'hover:bg-gray-50',
              ].join(' ')}
            >
              <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
              <span className="text-[11px] text-gray-400 w-5 tabular-nums flex-shrink-0">{i + 1}</span>
              <span className="text-sm text-gray-700 truncate">{item}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 text-gray-500 hover:text-gray-700 transition-colors rounded-lg"
          >
            取消
          </button>
          <button
            onClick={() => { onSave(true, items); onClose(); }}
            className="text-sm px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
