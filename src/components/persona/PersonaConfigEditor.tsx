'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Settings2,
  Eye, EyeOff, Check, X,
  ChevronUp, ChevronDown, ArrowLeft, RefreshCw,
  Users, LayoutList, Tag, Filter, BarChart2,
  Edit2, ChevronRight,
} from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { recommendPersonaBlocks, PERSONA_BLOCK_META, SEGMENT_COLORS } from '@/types/personaSchema';
import { PersonaDashboard } from './PersonaDashboard';
import { cn } from '@/lib/utils';
import type { Dataset } from '@/types/dataSchema';
import type {
  PersonaConfig, PersonaBlockField, PersonaBlockType,
  SegmentDef, SegmentColor,
} from '@/types/personaSchema';

// ── Helpers ────────────────────────────────────────────────────────

export interface PersonaConfigEditorProps {
  dataset: Dataset;
  onClose?: () => void;
}

const BLOCK_TYPES = Object.entries(PERSONA_BLOCK_META) as [
  PersonaBlockType,
  typeof PERSONA_BLOCK_META[PersonaBlockType],
][];

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── BlockEditorRow ─────────────────────────────────────────────────

function BlockEditorRow({
  block, index, total, fields, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  block:      PersonaBlockField;
  index:      number;
  total:      number;
  fields:     { key: string; name: string; type: string }[];
  onChange:   (patch: Partial<PersonaBlockField>) => void;
  onRemove:   () => void;
  onMoveUp:   () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'border rounded-xl transition-colors',
      block.visible ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/50',
    )}>
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <div className="flex flex-col gap-px flex-shrink-0">
          <button onClick={onMoveUp} disabled={index === 0} title="上移"
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed">
            <ChevronUp size={12} />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} title="下移"
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed">
            <ChevronDown size={12} />
          </button>
        </div>

        <select value={block.sourceFieldKey} onChange={e => onChange({ sourceFieldKey: e.target.value })}
          className="flex-1 min-w-0 text-xs font-medium border border-gray-200 rounded-lg px-1.5 py-1 bg-white outline-none cursor-pointer text-gray-700">
          <option value="" disabled>— 选择字段 —</option>
          {fields.map(f => <option key={f.key} value={f.key}>{f.name}</option>)}
        </select>

        <select value={block.blockType} onChange={e => onChange({ blockType: e.target.value as PersonaBlockType })}
          className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white outline-none text-gray-500 cursor-pointer flex-shrink-0">
          {BLOCK_TYPES.map(([type, meta]) => <option key={type} value={type}>{meta.label}</option>)}
        </select>

        <button onClick={() => onChange({ visible: !block.visible })} title={block.visible ? '点击隐藏' : '点击显示'}
          className={cn('p-1 rounded-lg transition-all flex-shrink-0',
            block.visible ? 'text-gray-400 hover:text-gray-700' : 'text-gray-300 hover:text-gray-500')}>
          {block.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>

        <button onClick={() => setExpanded(v => !v)} title="更多选项"
          className={cn('p-1 rounded-lg transition-all flex-shrink-0',
            expanded ? 'bg-blue-50 text-blue-500' : 'text-gray-300 hover:text-gray-500')}>
          <Settings2 size={12} />
        </button>

        <button onClick={onRemove} title="删除区块"
          className="p-1 rounded-lg text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
          <X size={12} />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">显示名</span>
            <input value={block.displayName} onChange={e => onChange({ displayName: e.target.value })}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-blue-400" />
          </div>
          {block.blockType === 'tag_cloud' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">最大标签</span>
              <input type="number" min={3} max={50} value={block.config?.maxTags ?? 10}
                onChange={e => onChange({ config: { ...block.config, maxTags: Number(e.target.value) } })}
                className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none" />
              <span className="text-xs text-gray-400">排序</span>
              <select value={block.config?.tagSortBy ?? 'count'}
                onChange={e => onChange({ config: { ...block.config, tagSortBy: e.target.value as 'count' | 'alpha' } })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none">
                <option value="count">按数量</option>
                <option value="alpha">按字母</option>
              </select>
            </div>
          )}
          {block.blockType === 'stat_badge' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">聚合方式</span>
              <select value={block.config?.statAggregation ?? 'top'}
                onChange={e => onChange({ config: { ...block.config, statAggregation: e.target.value as 'count' | 'avg' | 'top' } })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none">
                <option value="top">Top1 值</option>
                <option value="avg">平均值</option>
                <option value="count">总数</option>
              </select>
              <span className="text-xs text-gray-400">后缀</span>
              <input value={block.config?.statSuffix ?? ''} placeholder="如 岁/元"
                onChange={e => onChange({ config: { ...block.config, statSuffix: e.target.value } })}
                className="w-14 text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none" />
            </div>
          )}
          {block.blockType === 'distribution' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">图表类型</span>
              <select value={block.config?.chartType ?? 'bar'}
                onChange={e => onChange({ config: { ...block.config, chartType: e.target.value as 'bar' | 'pie' | 'donut' } })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none">
                <option value="bar">条形图</option>
                <option value="pie">饼图</option>
                <option value="donut">环形图</option>
              </select>
            </div>
          )}
          {block.blockType === 'date_range' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">粒度</span>
              <select value={block.config?.granularity ?? 'month'}
                onChange={e => onChange({ config: { ...block.config, granularity: e.target.value as 'year' | 'month' | 'day' } })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none">
                <option value="year">按年</option>
                <option value="month">按月</option>
                <option value="day">按日</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SegmentEditor (inline form for one segment) ────────────────────

function SegmentEditor({
  seg, fields, dataset, onChange, onSave, onCancel,
}: {
  seg:      SegmentDef;
  fields:   { key: string; name: string; type: string }[];
  dataset:  Dataset;
  onChange: (patch: Partial<SegmentDef>) => void;
  onSave:   () => void;
  onCancel: () => void;
}) {
  // Options for the filter field
  const filterFieldObj = dataset.fields.find(f => f.key === seg.filterField);
  const filterOptions  = filterFieldObj?.options ?? [];

  // Keyword input helpers
  const kws = [...(seg.keywords ?? []), '', '', '', ''].slice(0, 4);

  function setKw(i: number, v: string) {
    const next = [...kws] as [string, string, string, string];
    next[i] = v;
    onChange({ keywords: next });
  }

  function toggleFilterValue(val: string) {
    const cur = seg.filterValues ?? [];
    onChange({
      filterValues: cur.includes(val)
        ? cur.filter(v => v !== val)
        : [...cur, val],
    });
  }

  function toggleDemoField(key: string) {
    const cur = seg.demoFields ?? [];
    onChange({ demoFields: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] });
  }

  function toggleChartField(key: string) {
    const cur = seg.chartFields ?? [];
    onChange({ chartFields: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] });
  }

  const accentColor = SEGMENT_COLORS[seg.color].accent;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

      {/* Header bar */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: SEGMENT_COLORS[seg.color].bg, borderBottom: `1px solid ${SEGMENT_COLORS[seg.color].border}` }}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: accentColor }} />
        <input
          value={seg.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="分群名称…"
          className="flex-1 text-sm font-semibold bg-transparent outline-none placeholder-gray-400"
          style={{ color: accentColor }}
        />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onSave}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-all"
            style={{ background: accentColor }}>
            <Check size={11} />保存
          </button>
          <button onClick={onCancel}
            className="text-xs px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-all">
            取消
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">

        {/* Color */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-16 flex-shrink-0 font-medium">颜色主题</span>
          <div className="flex gap-2">
            {(Object.keys(SEGMENT_COLORS) as SegmentColor[]).map(c => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                title={SEGMENT_COLORS[c].label}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-all',
                  seg.color === c ? 'scale-125 border-gray-400' : 'border-transparent hover:scale-110',
                )}
                style={{ background: SEGMENT_COLORS[c].accent }}
              />
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tag size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">画像词标签（最多4个，展示为虚线标签）</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {kws.map((kw, i) => (
              <input
                key={i}
                value={kw}
                onChange={e => setKw(i, e.target.value)}
                placeholder={`标签 ${i + 1}`}
                className="text-xs px-2.5 py-1.5 border-dashed border-2 rounded-lg outline-none w-28 focus:border-blue-400 placeholder-gray-300"
                style={{ borderColor: kw ? accentColor : undefined, color: kw ? accentColor : undefined }}
              />
            ))}
          </div>
        </div>

        {/* Filter rule */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">筛选规则（哪些记录属于此分群）</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400 w-16 flex-shrink-0">按字段</span>
            <select
              value={seg.filterField}
              onChange={e => onChange({ filterField: e.target.value, filterValues: [] })}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white"
            >
              <option value="">— 全量（不过滤）—</option>
              {fields
                .filter(f => {
                  const fo = dataset.fields.find(df => df.key === f.key);
                  return fo?.options && fo.options.length > 0;
                })
                .map(f => <option key={f.key} value={f.key}>{f.name}</option>)
              }
            </select>
          </div>
          {seg.filterField && filterOptions.length > 0 && (
            <div className="ml-[4.5rem]">
              <div className="text-[10px] text-gray-400 mb-1.5">勾选属于此分群的值：</div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {filterOptions.map(opt => {
                  const selected = seg.filterValues?.includes(opt) ?? false;
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleFilterValue(opt)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-lg border transition-all',
                        selected
                          ? 'text-white border-transparent'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300',
                      )}
                      style={selected ? { background: accentColor } : undefined}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {(seg.filterValues?.length ?? 0) > 0 && (
                <div className="text-[10px] text-gray-400 mt-1">
                  已选 {seg.filterValues.length} 个值
                </div>
              )}
            </div>
          )}
        </div>

        {/* Demo fields */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">人口统计字段（左栏，展示为横向进度条）</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fields.map(f => {
              const active = seg.demoFields?.includes(f.key) ?? false;
              return (
                <button
                  key={f.key}
                  onClick={() => toggleDemoField(f.key)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-lg border transition-all',
                    active
                      ? 'text-white border-transparent'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300',
                  )}
                  style={active ? { background: accentColor } : undefined}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart fields */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">购买偏好字段（右下角迷你对比图）</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fields
              .filter(f => {
                const fo = dataset.fields.find(df => df.key === f.key);
                return fo?.options && fo.options.length > 0;
              })
              .map(f => {
                const active = seg.chartFields?.includes(f.key) ?? false;
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleChartField(f.key)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-lg border transition-all',
                      active
                        ? 'text-white border-transparent'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300',
                    )}
                    style={active ? { background: accentColor } : undefined}
                  >
                    {f.name}
                  </button>
                );
              })
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SegmentCard (collapsed view of one segment) ────────────────────

function SegmentCard({
  seg, index, total, dataset, onEdit, onDelete, onMoveUp, onMoveDown,
}: {
  seg:        SegmentDef;
  index:      number;
  total:      number;
  dataset:    Dataset;
  onEdit:     () => void;
  onDelete:   () => void;
  onMoveUp:   () => void;
  onMoveDown: () => void;
}) {
  const colors = SEGMENT_COLORS[seg.color];
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      {/* Reorder */}
      <div className="flex flex-col gap-px flex-shrink-0">
        <button onClick={onMoveUp} disabled={index === 0}
          className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
          <ChevronUp size={12} />
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1}
          className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
          <ChevronDown size={12} />
        </button>
      </div>

      {/* Color dot + name */}
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors.accent }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: colors.accent }}>{seg.name || '未命名分群'}</div>
        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
          {seg.filterField
            ? `筛选: ${dataset?.fields.find?.(f => f.key === seg.filterField)?.name ?? seg.filterField} = [${(seg.filterValues ?? []).slice(0, 3).join(', ')}${(seg.filterValues?.length ?? 0) > 3 ? '…' : ''}]`
            : '全量（不过滤）'
          }
          {(seg.demoFields?.length ?? 0) > 0 && ` · ${seg.demoFields.length} 个统计字段`}
        </div>
      </div>

      {/* Keywords preview */}
      <div className="hidden sm:flex gap-1 flex-shrink-0">
        {(seg.keywords ?? []).filter(Boolean).slice(0, 3).map((kw, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md border border-dashed"
            style={{ borderColor: colors.accent, color: colors.accent }}>
            {kw}
          </span>
        ))}
      </div>

      <button onClick={onEdit} title="编辑分群"
        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all flex-shrink-0 font-medium"
        style={{ color: colors.accent, background: `${colors.accent}15` }}>
        <Edit2 size={11} />编辑
      </button>
      <button onClick={onDelete} title="删除分群"
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// Workaround: SegmentCard needs dataset for field name lookup
// passing dataset as extra prop via a wrapper defined in SegmentsTab

// ── SegmentsTab ────────────────────────────────────────────────────

function SegmentsTab({
  localSegments, setLocalSegments, fields, dataset, setIsDirty,
}: {
  localSegments:    SegmentDef[];
  setLocalSegments: React.Dispatch<React.SetStateAction<SegmentDef[]>>;
  fields:           { key: string; name: string; type: string }[];
  dataset:          Dataset;
  setIsDirty:       (v: boolean) => void;
}) {
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingDraft, setDraft]      = useState<SegmentDef | null>(null);

  function startEdit(seg: SegmentDef) {
    setEditingId(seg.id);
    setDraft({ ...seg });
  }

  function saveEdit() {
    if (!editingDraft) return;
    setLocalSegments(prev => prev.map(s => s.id === editingDraft.id ? editingDraft : s));
    setIsDirty(true);
    setEditingId(null);
    setDraft(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function addSegment() {
    const newSeg: SegmentDef = {
      id:           genId(),
      name:         `分群 ${localSegments.length + 1}`,
      color:        (['red', 'yellow', 'green', 'blue', 'purple'] as SegmentColor[])[localSegments.length % 5],
      filterField:  '',
      filterValues: [],
      keywords:     ['', '', '', ''],
      demoFields:   [],
      chartFields:  [],
    };
    setLocalSegments(prev => [...prev, newSeg]);
    setIsDirty(true);
    startEdit(newSeg);
  }

  function deleteSegment(id: string) {
    if (!confirm('删除此分群定义？')) return;
    setLocalSegments(prev => prev.filter(s => s.id !== id));
    setIsDirty(true);
    if (editingId === id) { setEditingId(null); setDraft(null); }
  }

  function moveSegment(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= localSegments.length) return;
    setLocalSegments(prev => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setIsDirty(true);
  }

  return (
    <div className="space-y-3">
      {localSegments.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Users size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">还没有分群定义</p>
          <p className="text-xs mt-1 text-gray-300">添加分群后可在"分群报告"视图中查看各群体的画像详情</p>
        </div>
      )}

      {localSegments.map((seg, i) => (
        editingId === seg.id && editingDraft ? (
          <SegmentEditor
            key={seg.id}
            seg={editingDraft}
            fields={fields}
            dataset={dataset}
            onChange={patch => setDraft(prev => prev ? { ...prev, ...patch } : prev)}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
        ) : (
          <SegmentCard
            key={seg.id}
            seg={seg}
            index={i}
            total={localSegments.length}
            dataset={dataset}
            onEdit={() => startEdit(seg)}
            onDelete={() => deleteSegment(seg.id)}
            onMoveUp={() => moveSegment(i, -1)}
            onMoveDown={() => moveSegment(i, 1)}
          />
        )
      ))}

      <button
        onClick={addSegment}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all"
      >
        <Plus size={13} />
        添加分群
      </button>

      {localSegments.length > 0 && editingId === null && (
        <div className="text-[11px] text-gray-400 text-center pt-1">
          共 {localSegments.length} 个分群 · 点击「编辑」修改配置 · 保存后自动同步到云端
        </div>
      )}
    </div>
  );
}

// Hacky but needed: SegmentCard references dataset for display
// We solve by passing it via closure in SegmentsTab, which already has dataset.
// The SegmentCard component definition above uses dataset from the outer scope via a prop
// named `dataset` that isn't actually passed — so let's fix that properly:
// Re-declare SegmentCard with the dataset prop:
// (Already done by passing onDelete/onEdit closures that carry dataset context — OK.)

// ── PersonaConfigEditor ────────────────────────────────────────────

export function PersonaConfigEditor({ dataset, onClose }: PersonaConfigEditorProps) {
  const {
    personaConfigs, savePersonaConfig, removePersonaConfig,
    activePersonaConfigId, setActivePersonaConfigId,
    updateViewConfig,
  } = useDatasetStore();

  const configs      = personaConfigs[dataset.id] ?? [];
  const activeConfig = configs.find(c => c.id === activePersonaConfigId) ?? configs[0] ?? null;

  // ── Local state ──────────────────────────────────────────────────

  const [localBlocks,    setLocalBlocks]    = useState<PersonaBlockField[]>(activeConfig?.blocks ?? []);
  const [localColumns,   setLocalColumns]   = useState<1 | 2 | 3>(activeConfig?.layout?.columns ?? 2);
  const [localSegments,  setLocalSegments]  = useState<SegmentDef[]>(activeConfig?.segments ?? []);
  const [isDirty,        setIsDirty]        = useState(false);
  const [syncHint,       setSyncHint]       = useState(false);
  const [editorTab,      setEditorTab]      = useState<'blocks' | 'segments'>('blocks');

  useEffect(() => {
    setLocalBlocks(activeConfig?.blocks ?? []);
    setLocalColumns(activeConfig?.layout?.columns ?? 2);
    setLocalSegments(activeConfig?.segments ?? []);
    setIsDirty(false);
  }, [activeConfig?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = useMemo(
    () => dataset.fields.map(f => ({ key: f.key, name: f.name, type: f.type })),
    [dataset],
  );

  // ── Config-level actions ─────────────────────────────────────────

  function createNew() {
    const personaFields = dataset.fields
      .filter(f => f.type !== 'text')
      .map(f => ({ key: f.key, name: f.name, type: f.type }));
    const recommended = recommendPersonaBlocks(personaFields);
    const config: PersonaConfig = {
      id:        genId(),
      name:      `画像 ${configs.length + 1}`,
      datasetId: dataset.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocks:    recommended,
      segments:  [],
      layout:    { columns: 2, showHeader: true, showRecordCount: true },
    };
    savePersonaConfig(dataset.id, config);
    setActivePersonaConfigId(config.id);
  }

  function saveCurrent() {
    if (!activeConfig) return;
    savePersonaConfig(dataset.id, {
      ...activeConfig,
      blocks:    localBlocks,
      segments:  localSegments,
      layout:    { ...activeConfig.layout, columns: localColumns },
      updatedAt: new Date().toISOString(),
    });
    setIsDirty(false);
  }

  function discardChanges() {
    setLocalBlocks(activeConfig?.blocks ?? []);
    setLocalColumns(activeConfig?.layout?.columns ?? 2);
    setLocalSegments(activeConfig?.segments ?? []);
    setIsDirty(false);
  }

  function syncToChartMode() {
    if (!activeConfig) return;
    const keys = localBlocks
      .filter(b => b.visible && b.sourceFieldKey)
      .map(b => b.sourceFieldKey);
    updateViewConfig(dataset.id, { personaFieldKeys: keys });
    setSyncHint(true);
    setTimeout(() => setSyncHint(false), 2500);
  }

  // ── Block-level actions ──────────────────────────────────────────

  function addBlock() {
    const firstField = fields.find(f => f.type !== 'text') ?? fields[0];
    if (!firstField) return;
    setLocalBlocks(prev => [
      ...prev,
      { sourceFieldKey: firstField.key, displayName: firstField.name, blockType: 'distribution', order: prev.length, visible: true },
    ]);
    setIsDirty(true);
  }

  const updateBlock = useCallback((index: number, patch: Partial<PersonaBlockField>) => {
    setLocalBlocks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setIsDirty(true);
  }, []);

  function removeBlock(index: number) {
    setLocalBlocks(prev => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i })));
    setIsDirty(true);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= localBlocks.length) return;
    setLocalBlocks(prev => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((b, i) => ({ ...b, order: i }));
    });
    setIsDirty(true);
  }

  const previewConfig = useMemo(() => {
    if (!activeConfig) return null;
    return { ...activeConfig, blocks: localBlocks, layout: { ...activeConfig.layout, columns: localColumns } };
  }, [activeConfig, localBlocks, localColumns]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {onClose && (
          <>
            <button onClick={onClose}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-all flex-shrink-0">
              <ArrowLeft size={13} />返回
            </button>
            <div className="h-4 w-px bg-gray-200 flex-shrink-0" />
          </>
        )}

        {configs.length > 0 ? (
          <select value={activeConfig?.id ?? ''} onChange={e => setActivePersonaConfigId(e.target.value || null)}
            className="text-sm font-medium border border-gray-200 rounded-xl px-3 py-1.5 outline-none bg-white min-w-[140px]">
            {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <span className="text-sm text-gray-400">还没有画像配置</span>
        )}

        <button onClick={createNew}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all flex-shrink-0">
          <Plus size={12} />新建
        </button>

        {activeConfig && (
          <button
            onClick={() => { if (confirm(`删除「${activeConfig.name}」？此操作不可撤销。`)) removePersonaConfig(dataset.id, activeConfig.id); }}
            title="删除此配置"
            className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
            <Trash2 size={13} />
          </button>
        )}

        {isDirty && (
          <span className="ml-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            未保存
          </span>
        )}

        {activeConfig && (
          <button onClick={syncToChartMode}
            title="将此画像配置的字段顺序同步到图表模式"
            className={cn(
              'ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all flex-shrink-0',
              syncHint
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200',
            )}>
            {syncHint ? <><Check size={11} />已同步到图表模式</> : <><RefreshCw size={11} />同步到图表模式</>}
          </button>
        )}
      </div>

      {!activeConfig ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-sm">还没有画像配置</p>
          <button onClick={createNew} className="mt-3 text-sm text-blue-600 hover:underline">创建第一个画像</button>
        </div>
      ) : (
        <>
          {/* ── Tab switcher ── */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setEditorTab('blocks')}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                editorTab === 'blocks' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <LayoutList size={12} />画像区块
            </button>
            <button
              onClick={() => setEditorTab('segments')}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                editorTab === 'segments' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Users size={12} />分群报告
              {localSegments.length > 0 && (
                <span className="ml-0.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                  {localSegments.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Blocks tab ── */}
          {editorTab === 'blocks' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">区块列表</span>
                    <span className="text-[11px] text-gray-400">
                      {localBlocks.filter(b => b.visible).length}/{localBlocks.length} 可见
                    </span>
                  </div>
                  <button onClick={addBlock}
                    className="flex items-center gap-1 text-xs text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-all">
                    <Plus size={11} />添加区块
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">预览列数</span>
                  {([1, 2, 3] as const).map(n => (
                    <button key={n} onClick={() => { setLocalColumns(n); setIsDirty(true); }}
                      className={cn('w-7 h-7 text-xs rounded-lg border transition-all font-medium',
                        localColumns === n ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-500')}>
                      {n}
                    </button>
                  ))}
                </div>

                {localBlocks.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    暂无区块，点击「添加区块」开始构建画像
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {localBlocks.map((block, i) => (
                      <BlockEditorRow
                        key={`${block.sourceFieldKey}-${block.blockType}-${i}`}
                        block={block} index={i} total={localBlocks.length} fields={fields}
                        onChange={patch => updateBlock(i, patch)}
                        onRemove={() => removeBlock(i)}
                        onMoveUp={() => moveBlock(i, -1)}
                        onMoveDown={() => moveBlock(i, 1)}
                      />
                    ))}
                  </div>
                )}

                <div className={cn('flex items-center gap-2 pt-2 transition-opacity',
                  isDirty ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                  <button onClick={saveCurrent}
                    className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all">
                    <Check size={12} />保存
                  </button>
                  <button onClick={discardChanges}
                    className="text-xs px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-all">
                    撤销
                  </button>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">实时预览</div>
                {previewConfig && <PersonaDashboard dataset={dataset} config={previewConfig} />}
              </div>
            </div>
          )}

          {/* ── Segments tab ── */}
          {editorTab === 'segments' && (
            <div className="max-w-2xl space-y-4">
              <SegmentsTab
                localSegments={localSegments}
                setLocalSegments={setLocalSegments}
                fields={fields}
                dataset={dataset}
                setIsDirty={setIsDirty}
              />

              {/* Save bar */}
              <div className={cn('flex items-center gap-2 pt-1 transition-opacity',
                isDirty ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                <button onClick={saveCurrent}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all">
                  <Check size={12} />保存分群配置
                </button>
                <button onClick={discardChanges}
                  className="text-xs px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-all">
                  撤销
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
