'use client';

import { useState, useEffect, useRef } from 'react';
import { Pencil, Check } from 'lucide-react';
import { ChartRenderer } from './engine/ChartRenderer';
import { cn } from '@/lib/utils';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ChartDataItem, FlatChartType } from './engine/types';

interface ChartCardProps {
  title: string;
  data: ChartDataItem[];
  config: ChartConfig;
  chartType?: FlatChartType;
  isMultiSelect?: boolean;
  totalSamples?: number;
  validSamples?: number;
  onTitleChange?: (title: string) => void;
  className?: string;
  chartHeight?: number;
}

export function ChartCard({
  title, data, config, chartType = 'bar',
  isMultiSelect = false, totalSamples, validSamples,
  onTitleChange, className, chartHeight,
}: ChartCardProps) {
  const [displayTitle, setDisplayTitle] = useState(title);
  const [editing, setEditing]           = useState(false);
  const [editValue, setEditValue]       = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayTitle(title);
    setEditValue(title);
    setEditing(false);
  }, [title]);

  function startEdit() {
    setEditValue(displayTitle);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    const t = editValue.trim() || displayTitle;
    setDisplayTitle(t);
    setEditing(false);
    onTitleChange?.(t);
  }

  const compact = config.compact ?? false;

  return (
    <div
      className={cn('ui-card group/card', compact ? 'p-4' : 'p-5 md:p-6', className)}
    >
      {/* Title */}
      <div className={cn(compact ? 'mb-2 pb-2' : 'mb-3 pb-3', 'border-b border-gray-100')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                  className="flex-1 border-b border-blue-700 bg-transparent text-base font-semibold text-slate-900 outline-none"
                  maxLength={60}
                />
                <button aria-label="保存图表标题" onMouseDown={e => { e.preventDefault(); commitEdit(); }} className="flex-shrink-0 text-blue-700">
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <>
                <h3
                  onDoubleClick={startEdit}
                  title="双击编辑标题"
                  className="truncate text-base font-semibold leading-6 text-slate-900"
                >
                  {displayTitle}
                </h3>
                <button
                  onClick={startEdit}
                  aria-label="编辑图表标题"
                  title="编辑图表标题"
                  className="flex-shrink-0 rounded-md p-1 text-slate-400 opacity-60 transition-all hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 group-hover/card:opacity-100"
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {(totalSamples != null || validSamples != null) && (
            <span className="flex-shrink-0 pt-0.5 text-xs text-slate-500 tabular-nums">
              {isMultiSelect ? `n=${(totalSamples ?? 0).toLocaleString()}` : `n=${(validSamples ?? totalSamples ?? 0).toLocaleString()}`}
            </span>
          )}
        </div>
        {isMultiSelect && (
          <div className="mt-1 text-xs text-slate-500">多选题 · 各选项占有效样本比例</div>
        )}
      </div>

      {/* Chart */}
      <ChartRenderer
        type={chartType}
        data={data}
        config={config}
        isMultiSelect={isMultiSelect}
        totalSamples={totalSamples}
        height={chartHeight}
      />
    </div>
  );
}
