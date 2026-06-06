'use client';

/**
 * ChartCard — 统一图表卡片容器
 *
 * 封装：
 *  - 标题 / 样本数 / 备注
 *  - ChartRenderer（路由到对应引擎）
 *  - 管理员隐藏按钮（hover 显示）
 *  - 图表设置 ChartConfigPanel
 *  - PNG / SVG 导出
 *  - 入场动画
 *
 * 使用方式：
 *   <ChartCard
 *     title="年龄段"
 *     data={items}
 *     config={cfg}
 *     onConfigChange={setConfig}
 *     chartType="bar"
 *     onHide={() => hideDim('age_group')}
 *   />
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { EyeOff, Download, ImageDown, Pencil, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRole } from '@/components/RoleProvider';
import { exportSVG, exportPNG } from '@/lib/chartExport';
import { ChartConfigPanel } from './ChartConfigPanel';
import { ChartRenderer } from './engine/ChartRenderer';
import type { ChartConfig } from '@/lib/chartConfig';
import type { ChartDataItem, ChartType } from './engine/types';

// ── Props ─────────────────────────────────────────────────────
export interface ChartCardProps {
  // 数据
  data:         ChartDataItem[];
  title:        string;
  note?:        string;
  isMultiSelect?: boolean;
  totalSamples?:  number;
  validSamples?:  number;

  // 图表控制
  chartType?:   ChartType;
  config:       ChartConfig;
  onConfigChange?: (c: ChartConfig) => void;
  /** ChartConfigPanel 是否显示图例选项 */
  showLegendOption?: boolean;

  // 管理员操作
  /** 传入则在 admin 模式下显示隐藏按钮 */
  onHide?:     () => void;
  /**
   * 标题编辑回调。
   * - 不传：编辑仅影响本次会话（单次生效，不持久化）
   * - 传入：编辑后调用此回调，父组件决定是否持久化（如写入 store）
   */
  onTitleChange?: (newTitle: string) => void;

  // 外观
  animationDelay?: number;
  className?:      string;
  /** 覆盖图表高度 */
  chartHeight?:    number;
}

// ── 主组件 ────────────────────────────────────────────────────
export function ChartCard({
  data, title, note, isMultiSelect = false, totalSamples, validSamples,
  chartType = 'bar', config, onConfigChange, showLegendOption = false,
  onHide, onTitleChange, animationDelay = 0, className, chartHeight,
}: ChartCardProps) {
  const role    = useRole();
  const isAdmin = role === 'admin';
  const cardRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── 标题编辑状态 ──────────────────────────────────────────
  const [displayTitle, setDisplayTitle] = useState(title);
  const [editing, setEditing]           = useState(false);
  const [editValue, setEditValue]       = useState(title);

  // title prop 变化时（如切换字段）重置
  useEffect(() => {
    setDisplayTitle(title);
    setEditValue(title);
    setEditing(false);
  }, [title]);

  function startEdit() {
    setEditValue(displayTitle);
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  }

  function commitEdit() {
    const trimmed = editValue.trim() || displayTitle;
    setDisplayTitle(trimmed);
    setEditing(false);
    if (trimmed !== displayTitle || trimmed !== title) {
      onTitleChange?.(trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); }
  }
  // ─────────────────────────────────────────────────────────

  const handleExportSVG = useCallback(() => exportSVG(cardRef.current, displayTitle), [displayTitle]);
  const handleExportPNG = useCallback(() => exportPNG(cardRef.current, displayTitle), [displayTitle]);

  const sampleText = isMultiSelect
    ? `样本数 n=${(totalSamples ?? 0).toLocaleString()}，各项之和 = 100%`
    : `有效样本 n=${(validSamples ?? totalSamples ?? 0).toLocaleString()}`;

  return (
    <div
      ref={cardRef}
      className={cn('glass-card animate-slide-up relative group', className)}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* ── 管理员操作按钮（hover 显示，右上角浮层） ──────────── */}
      {isAdmin && (
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* 导出 SVG */}
          <button
            onClick={handleExportSVG}
            title="导出 SVG"
            className="p-1.5 rounded-lg bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55 transition-all no-tap"
          >
            <Download size={10} />
          </button>
          {/* 导出 PNG */}
          <button
            onClick={handleExportPNG}
            title="导出 PNG（2x 高清）"
            className="p-1.5 rounded-lg bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55 transition-all no-tap"
          >
            <ImageDown size={10} />
          </button>
          {/* 图表设置（仅当传入 onConfigChange 时显示） */}
          {onConfigChange && (
            <ChartConfigPanel
              config={config}
              onChange={onConfigChange}
              showLegendOption={showLegendOption}
            />
          )}
          {/* 隐藏字段 */}
          {onHide && (
            <button
              onClick={onHide}
              title="从画像中隐藏此字段（可在数据管理中重新开启）"
              className="p-1.5 rounded-lg bg-black/05 hover:bg-[#FF3B30]/12 text-black/30 hover:text-[#FF3B30] transition-all no-tap"
            >
              <EyeOff size={10} />
            </button>
          )}
        </div>
      )}

      {/* ── 卡片内容 ─────────────────────────────────────────── */}
      <div className="p-5">
        {/* 标题区 */}
        <div className="mb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-20">
              {editing ? (
                /* 编辑模式 */
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    className="flex-1 min-w-0 text-[15px] font-600 text-black/80 bg-transparent
                               border-b-2 border-[#007AFF] outline-none leading-tight py-0"
                    maxLength={60}
                  />
                  <button
                    onMouseDown={e => { e.preventDefault(); commitEdit(); }}
                    className="p-0.5 text-[#007AFF] hover:text-[#007AFF]/70 flex-shrink-0"
                  >
                    <Check size={13} />
                  </button>
                </div>
              ) : (
                /* 展示模式：hover 显示铅笔图标 */
                <>
                  <h3
                    onDoubleClick={startEdit}
                    title="双击编辑标题"
                    className="text-[15px] font-600 text-black/80 leading-tight truncate cursor-text"
                  >
                    {displayTitle}
                  </h3>
                  <button
                    onClick={startEdit}
                    title="编辑标题"
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-black/22
                               hover:text-black/50 transition-all flex-shrink-0"
                  >
                    <Pencil size={9} />
                  </button>
                </>
              )}
            </div>
            {isMultiSelect && (
              <span className="badge-ios badge-blue text-[10px] flex-shrink-0 mt-0.5">多选</span>
            )}
          </div>
          {(totalSamples != null || validSamples != null) && (
            <div className="text-[11px] text-black/35 mt-0.5">{sampleText}</div>
          )}
          {note && !isMultiSelect && (
            <div className="text-[10px] text-black/28 mt-0.5">{note}</div>
          )}
        </div>

        {/* 图表区 */}
        <ChartRenderer
          type={chartType}
          data={data}
          config={config}
          isMultiSelect={isMultiSelect}
          totalSamples={totalSamples}
          height={chartHeight}
        />
      </div>
    </div>
  );
}
