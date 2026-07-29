'use client';

import { useState } from 'react';
import { X, Plus, Search } from 'lucide-react';
import type { StatusGroup } from '@/lib/viewConfig';
import { useModalA11y } from '@/hooks/useModalA11y';

// ── Add-value dropdown ────────────────────────────────────────

function AddValueDropdown({
  options,
  onAdd,
}: {
  options: string[];
  onAdd: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  if (options.length === 0) return null;

  const filtered = search
    ? options.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 px-2.5 py-1 rounded-full hover:bg-blue-50 transition-all"
      >
        <Plus size={9} /> 添加值
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div className="absolute z-[70] top-7 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 min-w-[140px] max-h-52 flex flex-col">
            <div className="flex items-center gap-1.5 px-2 py-1 mb-1 border-b border-gray-100">
              <Search size={10} className="text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索…"
                className="w-full text-xs bg-transparent outline-none placeholder:text-gray-300"
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.map(v => (
                <button
                  key={v}
                  onClick={() => { onAdd(v); setOpen(false); }}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-gray-700 truncate"
                >
                  {v}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-[10px] text-gray-300 px-2 py-2">无匹配项</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Intent badge styles ───────────────────────────────────────

const INTENT_BORDER: Record<StatusGroup['intent'], string> = {
  strong:  'border-emerald-200 bg-emerald-50/50',
  neutral: 'border-blue-200   bg-blue-50/50',
  weak:    'border-red-200    bg-red-50/50',
};

const INTENT_DOT: Record<StatusGroup['intent'], string> = {
  strong:  'bg-emerald-500',
  neutral: 'bg-blue-500',
  weak:    'bg-red-400',
};

// ── StatusGroupEditor ─────────────────────────────────────────

interface Props {
  allValues: string[];        // all unique status values in this field
  groups:    StatusGroup[];   // current groups from viewConfig
  onSave:    (groups: StatusGroup[]) => void;
  onClose:   () => void;
}

export function StatusGroupEditor({ allValues, groups, onSave, onClose }: Props) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const [local, setLocal] = useState<StatusGroup[]>(
    () => groups.map(g => ({ ...g, values: [...g.values] })),
  );

  const assignedSet  = new Set(local.flatMap(g => g.values));
  const unassigned   = allValues.filter(v => !assignedSet.has(v));

  /* helpers */
  const updateGroup = (i: number, patch: Partial<StatusGroup>) =>
    setLocal(prev => prev.map((g, idx) => idx === i ? { ...g, ...patch } : g));

  const removeGroup = (i: number) =>
    setLocal(prev => prev.filter((_, idx) => idx !== i));

  /** Move value to group i (removing it from any other group first) */
  const addValueToGroup = (i: number, v: string) =>
    setLocal(prev => prev.map((g, idx) => ({
      ...g,
      values: idx === i
        ? [...g.values.filter(x => x !== v), v]
        : g.values.filter(x => x !== v),
    })));

  const removeValueFromGroup = (i: number, v: string) =>
    setLocal(prev => prev.map((g, idx) =>
      idx === i ? { ...g, values: g.values.filter(x => x !== v) } : g,
    ));

  const addGroup = () => {
    const id = Date.now().toString(36);
    setLocal(prev => [...prev, {
      key:    `group_${id}`,
      label:  `分组${prev.length + 1}`,
      values: [],
      color:  'blue',
      intent: 'neutral',
    }]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-groups-title"
        tabIndex={-1}
        className="mx-4 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden overscroll-contain rounded-2xl bg-white p-6 shadow-2xl"
      >

        {/* Header */}
        <div className="flex items-start justify-between mb-5 flex-shrink-0">
          <div>
            <h2 id="status-groups-title" className="text-base font-semibold text-gray-800">配置状态分组</h2>
            <p className="text-xs text-gray-400 mt-0.5">可将多个订单状态合并到同一意向分组中</p>
          </div>
          <button
            aria-label="关闭状态分组配置"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Unassigned pool */}
        {unassigned.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-xl flex-shrink-0">
            <p className="text-[11px] text-gray-400 mb-2 font-medium uppercase tracking-wide">
              未分组状态值
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map(v => (
                <span
                  key={v}
                  className="text-xs bg-white border border-gray-200 text-gray-500 px-2.5 py-1 rounded-full"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Group cards */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {local.map((g, gi) => {
            const available = allValues.filter(v => !g.values.includes(v));
            return (
              <div
                key={g.key}
                className={`border-2 rounded-xl p-4 ${INTENT_BORDER[g.intent]}`}
              >
                {/* Group header row */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${INTENT_DOT[g.intent]}`} />

                  {/* Label input */}
                  <input
                    value={g.label}
                    onChange={e => updateGroup(gi, { label: e.target.value })}
                    className="flex-1 text-sm font-semibold bg-transparent border-0 outline-none text-gray-800 placeholder:text-gray-400"
                    placeholder="分组名称"
                  />

                  {/* Intent selector */}
                  <select
                    value={g.intent}
                    onChange={e => {
                      const intent = e.target.value as StatusGroup['intent'];
                      updateGroup(gi, {
                        intent,
                        color: intent === 'strong' ? 'emerald' : intent === 'weak' ? 'red' : 'blue',
                      });
                    }}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 outline-none cursor-pointer hover:border-blue-300 transition-all"
                  >
                    <option value="strong">强意向</option>
                    <option value="neutral">中性意向</option>
                    <option value="weak">弱意向</option>
                  </select>

                  {/* Remove group (only if >1 groups) */}
                  {local.length > 1 && (
                    <button
                      onClick={() => removeGroup(gi)}
                      className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                      title="删除分组"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Values in group */}
                <div className="flex flex-wrap gap-1.5">
                  {g.values.map(v => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-700 pl-2.5 pr-1.5 py-1 rounded-full"
                    >
                      {v}
                      <button
                        onClick={() => removeValueFromGroup(gi, v)}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <X size={8} />
                      </button>
                    </span>
                  ))}
                  <AddValueDropdown
                    options={available}
                    onAdd={v => addValueToGroup(gi, v)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add group */}
        <button
          onClick={addGroup}
          className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 flex-shrink-0 self-start"
        >
          <Plus size={12} />
          添加分组
        </button>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
          >
            取消
          </button>
          <button
            onClick={() => { onSave(local); onClose(); }}
            className="text-xs px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-medium"
          >
            保存分组
          </button>
        </div>
      </div>
    </div>
  );
}
