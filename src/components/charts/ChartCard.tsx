'use client';

import { useState, useEffect, useRef } from 'react';
import { Pencil, Check } from 'lucide-react';
import { ChartRenderer } from './engine/ChartRenderer';
import { cn } from '@/lib/utils';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ChartDataItem, ChartType } from './engine/types';

interface ChartCardProps {
  title: string;
  data: ChartDataItem[];
  config: ChartConfig;
  chartType?: ChartType;
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
      className={cn('bg-white group/card border border-gray-200', compact ? 'p-3' : 'p-5', className)}
      style={{ borderTop: '2px solid #003087' }}
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
                  className="flex-1 text-[13px] font-medium text-gray-800 border-b border-[#003087] outline-none bg-transparent"
                  maxLength={60}
                />
                <button onMouseDown={e => { e.preventDefault(); commitEdit(); }} className="flex-shrink-0" style={{ color: '#003087' }}>
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <>
                <h3
                  onDoubleClick={startEdit}
                  title="双击编辑标题"
                  className="text-[13px] font-medium text-gray-800 leading-tight truncate cursor-text"
                >
                  {displayTitle}
                </h3>
                <button
                  onClick={startEdit}
                  className="opacity-0 group-hover/card:opacity-100 p-0.5 text-gray-300 hover:text-gray-500 transition-all flex-shrink-0"
                >
                  <Pencil size={10} />
                </button>
              </>
            )}
          </div>
          {(totalSamples != null || validSamples != null) && (
            <span className="text-[10px] text-gray-400 tracking-wider uppercase flex-shrink-0 pt-px tabular-nums">
              {isMultiSelect ? `n=${(totalSamples ?? 0).toLocaleString()}` : `n=${(validSamples ?? totalSamples ?? 0).toLocaleString()}`}
            </span>
          )}
        </div>
        {isMultiSelect && (
          <div className="text-[10px] text-gray-400 mt-0.5 tracking-wide">各项之和 = 100%</div>
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
