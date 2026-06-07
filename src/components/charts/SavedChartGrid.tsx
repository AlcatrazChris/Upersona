'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Trash2, Pencil, Check, BarChart2, Layers, Settings2, GripVertical,
  ArrowUpDown, Plus, Type, LayoutGrid, X,
} from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import type { CanvasTextElement, SavedChart } from '@/store/datasetStore';
import { aggregateField, aggregateFieldGrouped } from '@/lib/dataAggregator';
import type { GroupedChartData } from '@/lib/dataAggregator';
import { ChartRenderer } from './engine/ChartRenderer';
import { GroupedBarChartEngine } from './engine/GroupedBarChartEngine';
import { StackedBarChartEngine } from './engine/StackedBarChartEngine';
import { ManualOrderModal } from '@/components/fields/ManualOrderModal';
import type { Dataset, Field } from '@/types/dataSchema';
import type { ChartDataItem } from './engine/types';
import type { ChartConfig } from '@/lib/chartConfig';

const DEFAULT_W = 380;
const DEFAULT_H = 300;
const CANVAS_W  = 3200;
const CANVAS_H  = 2400;

// ── Default grid position for cards without an explicit position ──

function defaultPos(index: number): { x: number; y: number } {
  const cols = 3;
  const col  = index % cols;
  const row  = Math.floor(index / cols);
  return {
    x: 24 + col * (DEFAULT_W + 24),
    y: 24 + row * (DEFAULT_H + 24),
  };
}

// ── Resize corner handle (bottom-right) ──────────────────────────

function ResizeHandle({
  cardId, onCommit,
}: {
  cardId: string;
  onCommit: (w: number, h: number) => void;
}) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById(`ccard-${cardId}`);
    if (!el) return;
    const domEl  = el; // narrowed non-null ref for closures
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = domEl.offsetWidth;
    const startH = domEl.offsetHeight;

    function move(ev: MouseEvent) {
      const w = Math.max(260, startW + ev.clientX - startX);
      const h = Math.max(180, startH + ev.clientY - startY);
      domEl.style.width  = `${w}px`;
      domEl.style.height = `${h}px`;
    }
    function up(ev: MouseEvent) {
      const w = Math.max(260, startW + ev.clientX - startX);
      const h = Math.max(180, startH + ev.clientY - startY);
      onCommit(w, h);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup',   up);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-end justify-end
                 opacity-0 group-hover:opacity-100 transition-opacity cursor-se-resize z-10"
      title="拖动调整大小"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-300">
        <circle cx="8" cy="2" r="1.2" fill="currentColor"/>
        <circle cx="5" cy="5" r="1.2" fill="currentColor"/>
        <circle cx="8" cy="5" r="1.2" fill="currentColor"/>
        <circle cx="2" cy="8" r="1.2" fill="currentColor"/>
        <circle cx="5" cy="8" r="1.2" fill="currentColor"/>
        <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
      </svg>
    </div>
  );
}

// ── Inline card settings ──────────────────────────────────────────

function CardSettings({
  chart, field, datasetId, onPatch,
}: {
  chart: SavedChart;
  field?: Field;
  datasetId: string;
  onPatch: (p: Partial<SavedChart>) => void;
}) {
  const updateFieldOrdering = useDatasetStore(s => s.updateFieldOrdering);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const height = chart.config.chartHeight ?? 200;
  const canOrder = field
    && (field.type === 'single_choice' || field.type === 'multi_choice')
    && (field.options?.length ?? 0) >= 3;

  return (
    <>
      <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 space-y-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 w-8 flex-shrink-0">高度</span>
          <input
            type="range" min={120} max={700} step={10} value={height}
            onChange={e => onPatch({ config: { ...chart.config, chartHeight: Number(e.target.value) } })}
            className="flex-1 accent-blue-500 h-1.5"
          />
          <span className="text-gray-400 tabular-nums w-12 text-right">{height}px</span>
        </div>
        {canOrder && field && (
          <div className="flex items-center gap-3">
            <span className="text-gray-500 w-8 flex-shrink-0">排序</span>
            <button
              onClick={() => setShowOrderModal(true)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors ${
                field.isOrdered
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <ArrowUpDown size={9} />
              {field.isOrdered ? '已排序' : '设置顺序'}
            </button>
          </div>
        )}
      </div>
      {showOrderModal && field && (
        <ManualOrderModal
          field={field}
          onClose={() => setShowOrderModal(false)}
          onSave={(isOrdered, orderedValues) => {
            updateFieldOrdering(datasetId, field.key, isOrdered, orderedValues);
            setShowOrderModal(false);
          }}
        />
      )}
    </>
  );
}

// ── Chart card ───────────────────────────────────────────────────

function ChartCard({
  chart, pos, field, data, groupedData, mode, isCompare, isMultiSelect,
  totalSamples, datasetId, onDragStart, onDelete, onTitleChange, onPatch,
}: {
  chart: SavedChart;
  pos: { x: number; y: number };
  field?: Field;
  data?: ChartDataItem[];
  groupedData?: GroupedChartData;
  mode?: 'grouped' | 'stacked';
  isCompare: boolean;
  isMultiSelect: boolean;
  totalSamples: number;
  datasetId: string;
  onDragStart: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onTitleChange: (t: string) => void;
  onPatch: (p: Partial<SavedChart>) => void;
}) {
  const [editing,      setEditing]      = useState(false);
  const [editValue,    setEditValue]    = useState(chart.title);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const cardW  = chart.canvasWidth  ?? DEFAULT_W;
  const chartH = chart.config.chartHeight ?? 200;
  const engineConfig: ChartConfig = { ...chart.config, chartHeight: chartH };

  function commit() {
    onTitleChange(editValue.trim() || chart.title);
    setEditing(false);
  }

  return (
    <div
      id={`ccard-${chart.id}`}
      style={{ left: pos.x, top: pos.y, width: cardW }}
      className="absolute bg-white rounded-2xl border border-gray-100 p-4 group shadow-sm hover:shadow-md transition-shadow select-none overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        {/* Drag grip */}
        <div
          onMouseDown={onDragStart}
          className="flex-shrink-0 mr-1.5 mt-0.5 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing"
          title="拖动移动"
        >
          <GripVertical size={13} />
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5 flex-1 mr-2">
            <input
              autoFocus value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 text-sm font-semibold text-gray-800 border-b-2 border-blue-500 outline-none bg-transparent"
            />
            <button onMouseDown={e => { e.preventDefault(); commit(); }} className="text-blue-500 flex-shrink-0">
              <Check size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <h3
              className="text-sm font-semibold text-gray-800 truncate cursor-text hover:text-blue-600"
              onDoubleClick={() => { setEditValue(chart.title); setEditing(true); }}
              title="双击编辑标题"
            >
              {chart.title}
            </h3>
            {isCompare && (
              <span className="flex items-center gap-0.5 text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                <Layers size={8} />
                {mode === 'stacked' ? '堆积' : '簇状'}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`p-1.5 rounded-lg transition-all ${settingsOpen ? 'bg-blue-50 text-blue-500' : 'hover:bg-gray-100 text-gray-400'}`}
          >
            <Settings2 size={11} />
          </button>
          <button
            onClick={() => { setEditValue(chart.title); setEditing(true); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {settingsOpen && <CardSettings chart={chart} field={field} datasetId={datasetId} onPatch={onPatch} />}

      {/* Chart content */}
      <div className="chart-content" style={{ height: chartH, minHeight: 120 }}>
        {isCompare && groupedData ? (
          mode === 'stacked'
            ? <StackedBarChartEngine data={groupedData} config={engineConfig} height={chartH} />
            : <GroupedBarChartEngine data={groupedData} mode="grouped" config={engineConfig} height={chartH} />
        ) : data ? (
          <ChartRenderer
            type={chart.chartType}
            data={data}
            config={engineConfig}
            isMultiSelect={isMultiSelect}
            totalSamples={totalSamples}
            height={chartH}
          />
        ) : null}
      </div>

      <ResizeHandle
        cardId={chart.id}
        onCommit={(w, h) => onPatch({
          canvasWidth: w,
          config: { ...chart.config, chartHeight: Math.max(120, h - 90) },
        })}
      />
    </div>
  );
}

// ── Text element ─────────────────────────────────────────────────

function TextCard({
  el, onDragStart, onUpdate, onRemove,
}: {
  el: CanvasTextElement;
  onDragStart: (e: React.MouseEvent) => void;
  onUpdate: (p: Partial<CanvasTextElement>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(el.content === '双击编辑文字');
  const [val,     setVal]     = useState(el.content);

  function commit() {
    onUpdate({ content: val.trim() || el.content });
    setEditing(false);
  }

  return (
    <div
      id={`ccard-${el.id}`}
      style={{ left: el.x, top: el.y, width: el.width }}
      className="absolute group select-none"
    >
      {/* Floating toolbar */}
      <div className="absolute -top-7 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div
          onMouseDown={onDragStart}
          className="p-1 rounded text-gray-300 hover:text-gray-500 cursor-grab"
        >
          <GripVertical size={12} />
        </div>
        <button
          onClick={() => { setVal(el.content); setEditing(true); }}
          className="p-1 rounded hover:bg-gray-100 text-gray-400"
        >
          <Pencil size={10} />
        </button>
        <button
          onClick={() => onUpdate({ bold: !el.bold })}
          className={`p-1 rounded text-xs font-bold ${el.bold ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}
        >
          B
        </button>
        <select
          value={el.fontSize}
          onChange={e => onUpdate({ fontSize: Number(e.target.value) })}
          className="text-[10px] border-0 bg-gray-100 rounded px-1 py-0.5 text-gray-500"
        >
          {[10, 12, 14, 16, 20, 24, 32].map(s => (
            <option key={s} value={s}>{s}px</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"
        >
          <X size={10} />
        </button>
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Escape') { commit(); } }}
          style={{ fontSize: el.fontSize, fontWeight: el.bold ? 700 : 400, color: el.color, width: '100%' }}
          className="bg-white/90 border border-blue-400 rounded-xl p-2 outline-none resize-none leading-relaxed w-full"
          rows={3}
        />
      ) : (
        <div
          onDoubleClick={() => { setVal(el.content); setEditing(true); }}
          style={{ fontSize: el.fontSize, fontWeight: el.bold ? 700 : 400, color: el.color }}
          className="cursor-text leading-relaxed whitespace-pre-wrap break-words min-h-[28px] px-1 hover:bg-gray-50/60 rounded-xl transition-colors"
        >
          {el.content}
        </div>
      )}

      {/* Width resize handle */}
      <div
        onMouseDown={e => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startW = el.width;
          const move = (ev: MouseEvent) => {
            const w = Math.max(80, startW + ev.clientX - startX);
            const domEl = document.getElementById(`ccard-${el.id}`);
            if (domEl) domEl.style.width = `${w}px`;
          };
          const up = (ev: MouseEvent) => {
            onUpdate({ width: Math.max(80, startW + ev.clientX - startX) });
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup',   up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup',   up);
        }}
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
      />
    </div>
  );
}

// ── Canvas toolbar ────────────────────────────────────────────────

function CanvasToolbar({
  count, onAddText, onAutoArrange,
}: {
  count: number;
  onAddText: () => void;
  onAutoArrange: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{count} 张图表</span>
        <span className="text-[10px] text-gray-300">· 拖动标题栏移动 · 拖动右下角调整大小</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAddText}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <Type size={12} />
          添加文字
        </button>
        <button
          onClick={onAutoArrange}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          title="将所有图表整齐排列到网格"
        >
          <LayoutGrid size={12} />
          自动排列
        </button>
      </div>
    </div>
  );
}

// ── Root canvas component ─────────────────────────────────────────

export function SavedChartGrid({ dataset }: { dataset: Dataset }) {
  const {
    savedCharts, removeSavedChart, updateSavedChart,
    canvasElements, addCanvasText, updateCanvasText, removeCanvasText,
    updateFieldOrdering,
  } = useDatasetStore();

  const charts  = savedCharts[dataset.id]   ?? [];
  const textEls = canvasElements[dataset.id] ?? [];
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id:      string;
    type:    'chart' | 'text';
    startX:  number;
    startY:  number;
    origX:   number;
    origY:   number;
  } | null>(null);

  // Compute position for a chart (stored position or grid default)
  function chartPos(chart: SavedChart, idx: number) {
    return chart.position ?? defaultPos(idx);
  }

  // Start drag: store drag metadata, add global listeners that mutate DOM directly
  const startDrag = useCallback((
    e: React.MouseEvent,
    id: string,
    type: 'chart' | 'text',
    origX: number,
    origY: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();

    dragRef.current = {
      id, type,
      startX: e.clientX - wrapRect.left + wrap.scrollLeft,
      startY: e.clientY - wrapRect.top  + wrap.scrollTop,
      origX,
      origY,
    };

    const el = document.getElementById(`ccard-${id}`);
    if (el) {
      el.style.zIndex     = '50';
      el.style.boxShadow  = '0 12px 40px rgba(0,0,0,0.18)';
      el.style.transition = 'none';
    }

    function onMove(ev: MouseEvent) {
      const d = dragRef.current;
      if (!d || !wrap) return;
      const mouseX = ev.clientX - wrapRect.left + wrap.scrollLeft;
      const mouseY = ev.clientY - wrapRect.top  + wrap.scrollTop;
      const newX   = Math.max(0, d.origX + mouseX - d.startX);
      const newY   = Math.max(0, d.origY + mouseY - d.startY);
      const domEl  = document.getElementById(`ccard-${d.id}`);
      if (domEl) {
        domEl.style.left = `${newX}px`;
        domEl.style.top  = `${newY}px`;
      }
    }

    function onUp(ev: MouseEvent) {
      const d = dragRef.current;
      if (!d || !wrap) return;
      const mouseX = ev.clientX - wrapRect.left + wrap.scrollLeft;
      const mouseY = ev.clientY - wrapRect.top  + wrap.scrollTop;
      const newX   = Math.max(0, d.origX + mouseX - d.startX);
      const newY   = Math.max(0, d.origY + mouseY - d.startY);

      const domEl = document.getElementById(`ccard-${d.id}`);
      if (domEl) {
        domEl.style.zIndex     = '';
        domEl.style.boxShadow  = '';
        domEl.style.transition = '';
      }

      // Commit position to store (triggers re-render + IndexedDB persist)
      if (d.type === 'chart') {
        updateSavedChart(dataset.id, d.id, { position: { x: newX, y: newY } });
      } else {
        updateCanvasText(dataset.id, d.id, { x: newX, y: newY });
      }

      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [dataset.id, updateSavedChart, updateCanvasText]);

  function autoArrange() {
    charts.forEach((chart, i) => {
      updateSavedChart(dataset.id, chart.id, { position: defaultPos(i) });
    });
    textEls.forEach((el, i) => {
      updateCanvasText(dataset.id, el.id, {
        x: 24 + (i % 3) * 220,
        y: 24 + charts.length * (DEFAULT_H / 3),
      });
    });
  }

  function addText() {
    // Place new text near top-center of current scroll
    const wrap = wrapRef.current;
    const cx   = wrap ? wrap.scrollLeft + wrap.clientWidth  / 2 - 100 : 200;
    const cy   = wrap ? wrap.scrollTop  + 80                          : 80;
    addCanvasText(dataset.id, cx, cy);
  }

  if (charts.length === 0 && textEls.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">还没有保存的图表</p>
        <p className="text-xs mt-1 opacity-70">在「图表构建」标签页中创建并保存图表</p>
      </div>
    );
  }

  return (
    <div>
      <CanvasToolbar
        count={charts.length}
        onAddText={addText}
        onAutoArrange={autoArrange}
      />

      {/* Scrollable canvas viewport */}
      <div
        ref={wrapRef}
        className="relative overflow-auto rounded-2xl border border-gray-100"
        style={{ height: 'calc(100vh - 280px)', minHeight: 500, cursor: 'default' }}
      >
        {/* Inner canvas — large fixed area with dot grid background */}
        <div
          style={{
            position:        'relative',
            width:           CANVAS_W,
            height:          CANVAS_H,
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize:  '24px 24px',
            backgroundColor: '#f9fafb',
          }}
        >
          {/* Chart cards */}
          {charts.map((chart, idx) => {
            const field = dataset.fields.find(f => f.key === chart.fieldKey);
            if (!field) return null;

            const pos       = chartPos(chart, idx);
            const isCompare = !!(
              chart.groupFieldKey &&
              chart.selectedGroups?.length &&
              (chart.chartType === 'grouped-bar' || chart.chartType === 'stacked-bar')
            );

            let data: ChartDataItem[] | undefined;
            let groupedData: GroupedChartData | undefined;
            let mode: 'grouped' | 'stacked' | undefined;

            if (isCompare) {
              const groupField = dataset.fields.find(f => f.key === chart.groupFieldKey);
              if (groupField && chart.selectedGroups?.length) {
                groupedData = aggregateFieldGrouped(dataset.records, field, groupField, chart.selectedGroups);
                mode = chart.chartType === 'stacked-bar' ? 'stacked' : 'grouped';
              }
            } else {
              data = aggregateField(dataset.records, field);
            }

            return (
              <ChartCard
                key={chart.id}
                chart={chart}
                pos={pos}
                field={field}
                data={data}
                groupedData={groupedData}
                mode={mode}
                isCompare={isCompare}
                isMultiSelect={field.type === 'multi_choice'}
                totalSamples={dataset.rowCount}
                datasetId={dataset.id}
                onDragStart={e => startDrag(e, chart.id, 'chart', pos.x, pos.y)}
                onDelete={() => removeSavedChart(dataset.id, chart.id)}
                onTitleChange={t => updateSavedChart(dataset.id, chart.id, { title: t })}
                onPatch={p => updateSavedChart(dataset.id, chart.id, p)}
              />
            );
          })}

          {/* Text elements */}
          {textEls.map(el => (
            <TextCard
              key={el.id}
              el={el}
              onDragStart={e => startDrag(e, el.id, 'text', el.x, el.y)}
              onUpdate={p => updateCanvasText(dataset.id, el.id, p)}
              onRemove={() => removeCanvasText(dataset.id, el.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
