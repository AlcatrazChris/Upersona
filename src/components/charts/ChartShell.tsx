'use client';

/**
 * ChartShell — 专用图表的统一卡片包壳
 *
 * 为无法直接用 ChartCard（ChartDataItem[] 格式）的特殊图表提供：
 *  - glass-card 容器 + 入场动画
 *  - 标题 / 副标题 / 样本数显示
 *  - 管理员 hover 导出按钮（SVG + PNG），与 ChartCard 完全一致
 *  - 可选的 onHide 隐藏按钮
 *
 * 使用方式：
 *   <ChartShell title="地域对比" note="大区 · 4 个地区">
 *     <StackedBarChart ... />
 *   </ChartShell>
 */

import { useRef, useCallback } from 'react';
import { Download, ImageDown, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRole } from '@/components/RoleProvider';
import { exportSVG, exportPNG } from '@/lib/chartExport';

export interface ChartShellProps {
  title:       string;
  note?:       string;
  /** 显示在标题右侧的样本信息，如 "n=1,234" */
  sampleBadge?: string;
  /** 管理员隐藏回调 */
  onHide?:     () => void;
  animationDelay?: number;
  className?:  string;
  children:    React.ReactNode;
}

export function ChartShell({
  title, note, sampleBadge, onHide,
  animationDelay = 0, className, children,
}: ChartShellProps) {
  const role    = useRole();
  const isAdmin = role === 'admin';
  const cardRef = useRef<HTMLDivElement>(null);

  const handleExportSVG = useCallback(() => exportSVG(cardRef.current, title), [title]);
  const handleExportPNG = useCallback(() => exportPNG(cardRef.current, title), [title]);

  return (
    <div
      ref={cardRef}
      className={cn('glass-card animate-slide-up relative group', className)}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* ── 管理员导出 / 隐藏按钮（hover 显示） ────────── */}
      {isAdmin && (
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleExportSVG}
            title="导出 SVG"
            className="p-1.5 rounded-lg bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55 transition-all no-tap"
          >
            <Download size={10} />
          </button>
          <button
            onClick={handleExportPNG}
            title="导出 PNG（2× 高清）"
            className="p-1.5 rounded-lg bg-black/04 hover:bg-black/08 text-black/25 hover:text-black/55 transition-all no-tap"
          >
            <ImageDown size={10} />
          </button>
          {onHide && (
            <button
              onClick={onHide}
              title="隐藏此图表"
              className="p-1.5 rounded-lg bg-black/05 hover:bg-[#FF3B30]/12 text-black/30 hover:text-[#FF3B30] transition-all no-tap"
            >
              <EyeOff size={10} />
            </button>
          )}
        </div>
      )}

      {/* ── 标题区 ───────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-0 mb-0">
        <div className="flex items-start justify-between gap-2 pr-20">
          <h3 className="text-[15px] font-600 text-black/80 leading-tight">{title}</h3>
          {sampleBadge && (
            <span className="text-[11px] text-black/35 flex-shrink-0 mt-0.5 tabular-nums">
              {sampleBadge}
            </span>
          )}
        </div>
        {note && (
          <div className="text-[11px] text-black/35 mt-0.5">{note}</div>
        )}
      </div>

      {/* ── 图表内容 ─────────────────────────────────────── */}
      <div className="p-5 pt-3">
        {children}
      </div>
    </div>
  );
}
