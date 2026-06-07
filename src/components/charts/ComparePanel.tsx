'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Dataset } from '@/types/dataSchema';

interface ComparePanelProps {
  dataset: Dataset;
  mainFieldKey: string | null;
  groupFieldKey: string | null;
  selectedGroups: string[];
  onGroupFieldChange: (key: string | null, autoSelected: string[]) => void;
  onSelectedGroupsChange: (groups: string[]) => void;
}

const CATEGORICAL = new Set(['single_choice', 'boolean', 'text']);
const MAX_SELECT = 12;
const MIN_SELECT = 2;

function topValues(records: Record<string, unknown>[], key: string, limit = 8) {
  const freq = new Map<string, number>();
  for (const r of records) {
    const v = String(r[key] ?? '').trim();
    if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function ComparePanel({
  dataset, mainFieldKey, groupFieldKey, selectedGroups,
  onGroupFieldChange, onSelectedGroupsChange,
}: ComparePanelProps) {
  const candidates = useMemo(
    () => dataset.fields.filter(f =>
      CATEGORICAL.has(f.type) &&
      f.key !== mainFieldKey &&
      (f.statistics?.unique ?? 0) >= 2 &&
      (f.statistics?.unique ?? Infinity) <= 30
    ),
    [dataset.fields, mainFieldKey],
  );

  const topVals = useMemo(
    () => groupFieldKey ? topValues(dataset.records, groupFieldKey, MAX_SELECT) : [],
    [dataset.records, groupFieldKey],
  );

  function handleFieldChange(key: string) {
    if (!key) { onGroupFieldChange(null, []); return; }
    const auto = topValues(dataset.records, key, Math.min(3, MAX_SELECT)).map(([v]) => v);
    onGroupFieldChange(key, auto);
  }

  function toggle(value: string) {
    if (selectedGroups.includes(value)) {
      if (selectedGroups.length <= MIN_SELECT) return;
      onSelectedGroupsChange(selectedGroups.filter(g => g !== value));
    } else {
      if (selectedGroups.length >= MAX_SELECT) return;
      onSelectedGroupsChange([...selectedGroups, value]);
    }
  }

  return (
    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 space-y-2.5">
      {/* Group field selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600 flex-shrink-0 w-14">分组字段</span>
        <select
          value={groupFieldKey ?? ''}
          onChange={e => handleFieldChange(e.target.value)}
          className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        >
          <option value="">— 选择分组字段 —</option>
          {candidates.map(f => (
            <option key={f.key} value={f.key}>
              {f.name}（{f.statistics?.unique ?? '?'} 个值）
            </option>
          ))}
        </select>
      </div>

      {/* Group value chips */}
      {groupFieldKey && topVals.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-gray-600 flex-shrink-0 w-14 pt-1">
            对比值
            <span className="text-gray-400 font-normal block text-[10px]">{MIN_SELECT}–{MAX_SELECT} 个</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {topVals.map(([value, count]) => {
              const selected = selectedGroups.includes(value);
              const maxed = !selected && selectedGroups.length >= MAX_SELECT;
              return (
                <button
                  key={value}
                  onClick={() => toggle(value)}
                  disabled={maxed}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                    selected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : maxed
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600',
                  )}
                >
                  {value}
                  <span className={cn('text-[10px] tabular-nums', selected ? 'text-blue-200' : 'text-gray-400')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {groupFieldKey && topVals.length === 0 && (
        <p className="text-xs text-gray-400">该字段没有有效值</p>
      )}

      {!groupFieldKey && candidates.length === 0 && (
        <p className="text-xs text-gray-400">无可用分组字段（需要单选/布尔类型，且唯一值 2–30）</p>
      )}
    </div>
  );
}
