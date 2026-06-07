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

  const sampleText = isMultiSelect
    ? `样本数 n=${(totalSamples ?? 0).toLocaleString()}，各项之和 = 100%`
    : `有效样本 n=${(validSamples ?? totalSamples ?? 0).toLocaleString()}`;

  return (
    <div className={cn('bg-white rounded-2xl p-5 group/card', className)}>
      {/* Title */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5">
          {editing ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="flex-1 text-base font-semibold text-gray-800 border-b-2 border-blue-500 outline-none bg-transparent"
                maxLength={60}
              />
              <button onMouseDown={e => { e.preventDefault(); commitEdit(); }} className="text-blue-500 flex-shrink-0">
                <Check size={13} />
              </button>
            </div>
          ) : (
            <>
              <h3
                onDoubleClick={startEdit}
                title="双击编辑标题"
                className="text-base font-semibold text-gray-800 leading-tight truncate cursor-text"
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
          <div className="text-xs text-gray-400 mt-0.5">{sampleText}</div>
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
