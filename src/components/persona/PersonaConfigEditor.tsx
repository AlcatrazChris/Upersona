'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Settings2,
  Eye, EyeOff, Check, X,
  ChevronUp, ChevronDown, ArrowLeft,
} from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import { getBlockFieldTypes } from '@/lib/personaEngine';
import { recommendPersonaBlocks, PERSONA_BLOCK_META } from '@/types/personaSchema';
import { PersonaDashboard } from './PersonaDashboard';
import { cn } from '@/lib/utils';
import type { Dataset } from '@/types/dataSchema';
import type { PersonaConfig, PersonaBlockField, PersonaBlockType } from '@/types/personaSchema';

// ── Types / helpers ────────────────────────────────────────────────

export interface PersonaConfigEditorProps {
  dataset: Dataset;
  /** When provided, a "← 返回" button is shown that calls this. */
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
  block,
  index,
  total,
  fields,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  block:       PersonaBlockField;
  index:       number;
  total:       number;
  fields:      { key: string; name: string; type: string }[];
  onChange:    (patch: Partial<PersonaBlockField>) => void;
  onRemove:    () => void;
  onMoveUp:    () => void;
  onMoveDown:  () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'border rounded-xl transition-colors',
      block.visible ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/50',
    )}>
      {/* Compact header row */}
      <div className="flex items-center gap-1.5 px-2.5 py-2">

        {/* Up / Down reorder */}
        <div className="flex flex-col gap-px flex-shrink-0">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            title="上移"
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="下移"
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Source field selector */}
        <select
          value={block.sourceFieldKey}
          onChange={e => onChange({ sourceFieldKey: e.target.value })}
          className="flex-1 min-w-0 text-xs font-medium border border-gray-200 rounded-lg px-1.5 py-1 bg-white outline-none cursor-pointer text-gray-700"
        >
          <option value="" disabled>— 选择字段 —</option>
          {fields.map(f => (
            <option key={f.key} value={f.key}>{f.name}</option>
          ))}
        </select>

        {/* Block type selector */}
        <select
          value={block.blockType}
          onChange={e => onChange({ blockType: e.target.value as PersonaBlockType })}
          className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white outline-none text-gray-500 cursor-pointer flex-shrink-0"
        >
          {BLOCK_TYPES.map(([type, meta]) => (
            <option key={type} value={type}>{meta.label}</option>
          ))}
        </select>

        {/* Visibility toggle */}
        <button
          onClick={() => onChange({ visible: !block.visible })}
          title={block.visible ? '点击隐藏' : '点击显示'}
          className={cn(
            'p-1 rounded-lg transition-all flex-shrink-0',
            block.visible ? 'text-gray-400 hover:text-gray-700' : 'text-gray-300 hover:text-gray-500',
          )}
        >
          {block.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>

        {/* Expand settings */}
        <button
          onClick={() => setExpanded(v => !v)}
          title="更多选项"
          className={cn(
            'p-1 rounded-lg transition-all flex-shrink-0',
            expanded ? 'bg-blue-50 text-blue-500' : 'text-gray-300 hover:text-gray-500',
          )}
        >
          <Settings2 size={12} />
        </button>

        {/* Remove */}
        <button
          onClick={onRemove}
          title="删除区块"
          className="p-1 rounded-lg text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Expanded extra options */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 space-y-2.5">
          {/* Display name */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">显示名</span>
            <input
              value={block.displayName}
              onChange={e => onChange({ displayName: e.target.value })}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-blue-400"
            />
          </div>

          {/* tag_cloud options */}
          {block.blockType === 'tag_cloud' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">最大标签</span>
              <input
                type="number" min={3} max={50}
                value={block.config?.maxTags ?? 10}
                onChange={e => onChange({ config: { ...block.config, maxTags: Number(e.target.value) } })}
                className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none"
              />
              <span className="text-xs text-gray-400">排序</span>
              <select
                value={block.config?.tagSortBy ?? 'count'}
                onChange={e => onChange({ config: { ...block.config, tagSortBy: e.target.value as 'count' | 'alpha' } })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none"
              >
                <option value="count">按数量</option>
                <option value="alpha">按字母</option>
              </select>
            </div>
          )}

          {/* stat_badge options */}
          {block.blockType === 'stat_badge' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">聚合方式</span>
              <select
                value={block.config?.statAggregation ?? 'top'}
                onChange={e => onChange({ config: { ...block.config, statAggregation: e.target.value as 'count' | 'avg' | 'top' } })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none"
              >
                <option value="top">Top1 值</option>
                <option value="avg">平均值</option>
                <option value="count">总数</option>
              </select>
              <span className="text-xs text-gray-400">后缀</span>
              <input
                value={block.config?.statSuffix ?? ''}
                onChange={e => onChange({ config: { ...block.config, statSuffix: e.target.value } })}
                placeholder="如 岁/元"
                className="w-14 text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none"
              />
            </div>
          )}

          {/* distribution options */}
          {block.blockType === 'distribution' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">图表类型</span>
              <select
                value={block.config?.chartType ?? 'bar'}
                onChange={e => onChange({ config: { ...block.config, chartType: e.target.value as 'bar' | 'pie' | 'donut' } })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none"
              >
                <option value="bar">条形图</option>
                <option value="pie">饼图</option>
                <option value="donut">环形图</option>
              </select>
            </div>
          )}

          {/* date_range options */}
          {block.blockType === 'date_range' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-[52px] flex-shrink-0">粒度</span>
              <select
                value={block.config?.granularity ?? 'month'}
                onChange={e => onChange({ config: { ...block.config, granularity: e.target.value as 'year' | 'month' | 'day' } })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 outline-none"
              >
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

// ── PersonaConfigEditor ────────────────────────────────────────────

export function PersonaConfigEditor({ dataset, onClose }: PersonaConfigEditorProps) {
  const {
    personaConfigs, savePersonaConfig, removePersonaConfig,
    activePersonaConfigId, setActivePersonaConfigId,
  } = useDatasetStore();

  const configs      = personaConfigs[dataset.id] ?? [];
  const activeConfig = configs.find(c => c.id === activePersonaConfigId) ?? configs[0] ?? null;

  // ── Local editing state ──────────────────────────────────────────
  // localBlocks is ALWAYS initialized — no null sentinel needed.
  // isDirty tracks whether there are unsaved changes.
  const [localBlocks,  setLocalBlocks]  = useState<PersonaBlockField[]>(activeConfig?.blocks ?? []);
  const [localColumns, setLocalColumns] = useState<1 | 2 | 3>(activeConfig?.layout?.columns ?? 2);
  const [isDirty,      setIsDirty]      = useState(false);

  // Sync local state whenever the active config changes (user switches config or creates a new one)
  useEffect(() => {
    setLocalBlocks(activeConfig?.blocks ?? []);
    setLocalColumns(activeConfig?.layout?.columns ?? 2);
    setIsDirty(false);
  }, [activeConfig?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = useMemo(
    () => dataset.fields.map(f => ({ key: f.key, name: f.name, type: f.type })),
    [dataset],
  );
  const fieldTypes = useMemo(() => getBlockFieldTypes(dataset), [dataset]);

  // ── Config-level actions ─────────────────────────────────────────

  function createNew() {
    const personaKeys = dataset.fields
      .filter(f =>
        f.type === 'single_choice' || f.type === 'multi_choice' ||
        f.type === 'number'        || f.type === 'boolean'       || f.type === 'date',
      )
      .map(f => f.key)
      .slice(0, 12);

    const recommended = recommendPersonaBlocks(personaKeys, fieldTypes);
    const config: PersonaConfig = {
      id:        genId(),
      name:      `画像 ${configs.length + 1}`,
      datasetId: dataset.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocks:    recommended,
      layout:    { columns: 2, showHeader: true, showRecordCount: true },
    };
    savePersonaConfig(dataset.id, config);
    setActivePersonaConfigId(config.id);
    // useEffect will fire on activeConfig?.id change and reset local state
  }

  function saveCurrent() {
    if (!activeConfig) return;
    savePersonaConfig(dataset.id, {
      ...activeConfig,
      blocks:    localBlocks,
      layout:    { ...activeConfig.layout, columns: localColumns },
      updatedAt: new Date().toISOString(),
    });
    setIsDirty(false);
  }

  function discardChanges() {
    setLocalBlocks(activeConfig?.blocks ?? []);
    setLocalColumns(activeConfig?.layout?.columns ?? 2);
    setIsDirty(false);
  }

  // ── Block-level actions ──────────────────────────────────────────

  function addBlock() {
    const firstField = fields.find(f => f.type !== 'text') ?? fields[0];
    if (!firstField) return;
    setLocalBlocks(prev => [
      ...prev,
      {
        sourceFieldKey: firstField.key,
        displayName:    firstField.name,
        blockType:      'distribution',
        order:          prev.length,
        visible:        true,
      },
    ]);
    setIsDirty(true);
  }

  // updateBlock now works from the FIRST edit — prev is always a real array
  const updateBlock = useCallback((index: number, patch: Partial<PersonaBlockField>) => {
    setLocalBlocks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setIsDirty(true);
  }, []);

  function removeBlock(index: number) {
    setLocalBlocks(prev =>
      prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i })),
    );
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

  // ── Preview config ───────────────────────────────────────────────

  const previewConfig = useMemo(() => {
    if (!activeConfig) return null;
    return {
      ...activeConfig,
      blocks: localBlocks,
      layout: { ...activeConfig.layout, columns: localColumns },
    };
  }, [activeConfig, localBlocks, localColumns]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {onClose && (
          <>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-all flex-shrink-0"
            >
              <ArrowLeft size={13} />
              返回
            </button>
            <div className="h-4 w-px bg-gray-200 flex-shrink-0" />
          </>
        )}

        {/* Config selector */}
        {configs.length > 0 ? (
          <select
            value={activeConfig?.id ?? ''}
            onChange={e => setActivePersonaConfigId(e.target.value || null)}
            className="text-sm font-medium border border-gray-200 rounded-xl px-3 py-1.5 outline-none bg-white min-w-[140px]"
          >
            {configs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-400">还没有画像配置</span>
        )}

        <button
          onClick={createNew}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all flex-shrink-0"
        >
          <Plus size={12} />
          新建
        </button>

        {activeConfig && (
          <button
            onClick={() => {
              if (confirm(`删除「${activeConfig.name}」？此操作不可撤销。`)) {
                removePersonaConfig(dataset.id, activeConfig.id);
              }
            }}
            title="删除此配置"
            className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
          >
            <Trash2 size={13} />
          </button>
        )}

        {/* Unsaved badge */}
        {isDirty && (
          <span className="ml-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            未保存
          </span>
        )}
      </div>

      {/* ── Empty state ── */}
      {!activeConfig ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-sm">还没有画像配置</p>
          <button onClick={createNew} className="mt-3 text-sm text-blue-600 hover:underline">
            创建第一个画像
          </button>
        </div>
      ) : (
        <>
          {/* ── Block list + Preview ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left: block editor */}
            <div className="lg:col-span-2 space-y-3">
              {/* Sub-toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    区块列表
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {localBlocks.filter(b => b.visible).length}/{localBlocks.length} 可见
                  </span>
                </div>
                <button
                  onClick={addBlock}
                  className="flex items-center gap-1 text-xs text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-all"
                >
                  <Plus size={11} />
                  添加区块
                </button>
              </div>

              {/* Columns picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">预览列数</span>
                {([1, 2, 3] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => { setLocalColumns(n); setIsDirty(true); }}
                    className={cn(
                      'w-7 h-7 text-xs rounded-lg border transition-all font-medium',
                      localColumns === n
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-500',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Block rows */}
              {localBlocks.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  暂无区块，点击「添加区块」开始构建画像
                </div>
              ) : (
                <div className="space-y-1.5">
                  {localBlocks.map((block, i) => (
                    <BlockEditorRow
                      key={`${block.sourceFieldKey}-${block.blockType}-${i}`}
                      block={block}
                      index={i}
                      total={localBlocks.length}
                      fields={fields}
                      onChange={patch => updateBlock(i, patch)}
                      onRemove={() => removeBlock(i)}
                      onMoveUp={() => moveBlock(i, -1)}
                      onMoveDown={() => moveBlock(i, 1)}
                    />
                  ))}
                </div>
              )}

              {/* Save bar — inline with the list */}
              <div className={cn(
                'flex items-center gap-2 pt-2 transition-opacity',
                isDirty ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}>
                <button
                  onClick={saveCurrent}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                >
                  <Check size={12} />
                  保存
                </button>
                <button
                  onClick={discardChanges}
                  className="text-xs px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-all"
                >
                  撤销
                </button>
              </div>
            </div>

            {/* Right: live preview */}
            <div className="lg:col-span-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                实时预览
              </div>
              {previewConfig && (
                <PersonaDashboard dataset={dataset} config={previewConfig} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
