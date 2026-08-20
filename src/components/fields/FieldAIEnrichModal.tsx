'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles, X, Loader2, Check, ChevronDown, BookMarked, Trash2,
} from 'lucide-react';
import { useDatasetStore } from '@/store/datasetStore';
import type { Field } from '@/types/dataSchema';
import { useModalA11y } from '@/hooks/useModalA11y';

interface Props {
  datasetId: string;
  field: Field;
  onClose: () => void;
}

// ── Save-prompt sub-panel ─────────────────────────────────────

function SavePromptPanel({
  prompt,
  onClose,
}: {
  prompt: string;
  onClose: () => void;
}) {
  const { addSavedPrompt } = useDatasetStore();
  const [name, setName] = useState('');

  function save() {
    const n = name.trim();
    if (!n) return;
    addSavedPrompt(n, prompt);
    onClose();
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-xl border border-amber-200">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
        placeholder="模板名称，例如：职位分类"
        className="flex-1 text-xs bg-transparent border-0 outline-none text-amber-800 placeholder-amber-400"
      />
      <button onClick={save} disabled={!name.trim()}
        className="text-xs px-2 py-0.5 bg-amber-500 text-white rounded-lg disabled:opacity-40">
        保存
      </button>
      <button onClick={onClose} className="text-amber-400 hover:text-amber-600">
        <X size={12} />
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────

export function FieldAIEnrichModal({ datasetId, field, onClose }: Props) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const { savedPrompts, removeSavedPrompt, addAIDerivedField } = useDatasetStore();

  // Get unique values for this field (up to 200)
  const dataset = useDatasetStore(s => s.datasets.find(d => d.id === datasetId));
  const uniqueVals = dataset
    ? [...new Set(
        dataset.records
          .map(r => String(r[field.key] ?? '').trim())
          .filter(Boolean)
      )].slice(0, 200)
    : [];

  const [prompt,       setPrompt]       = useState('');
  const [newFieldName, setNewFieldName] = useState(`${field.name}_归类`);
  const [mapping,      setMapping]      = useState<Record<string, string> | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);

  // Suggest a default prompt based on field options
  useEffect(() => {
    if (field.options?.length) {
      const examples = field.options.slice(0, 6).join('、');
      setPrompt(`请对"${field.name}"字段进行归类，当前取值示例：${examples}。\n请给出新的分类方式，并在指令中列出所有目标类别（例如：归类为 A/B/C/其他）。`);
    } else {
      setPrompt(`请对"${field.name}"字段进行归类，并在指令中列出所有目标类别（例如：归类为 A/B/C/其他）。`);
    }
  }, [field]);

  async function runMapping() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setMapping(null);
    try {
      const res = await fetch('/api/enrich-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldName: field.name, values: uniqueVals, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '请求失败');
      setMapping(data.mapping as Record<string, string>);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }

  function createField() {
    if (!mapping) return;
    const key = `${field.key}__ai_${Date.now().toString(36)}`;
    addAIDerivedField(datasetId, field.key, key, newFieldName.trim() || `${field.name}_归类`, mapping, prompt.trim());
    onClose();
  }

  // Compute a preview of unique categories
  const categoryGroups = mapping
    ? Object.entries(
        Object.values(mapping).reduce<Record<string, number>>((acc, v) => {
          acc[v] = (acc[v] ?? 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-enrich-title"
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden overscroll-contain rounded-2xl border border-gray-100 bg-white shadow-2xl"
      >

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="field-enrich-title" className="text-sm font-semibold text-gray-800">AI 字段归类</h2>
            <p className="text-xs text-gray-400 truncate">
              来源：<span className="font-medium text-gray-600">{field.name}</span>
              {' · '}{uniqueVals.length} 个唯一取值
            </p>
          </div>
          <button aria-label="关闭 AI 字段归类" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Unique values preview */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">字段取值示例</p>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {uniqueVals.slice(0, 30).map(v => (
                <span key={v} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{v}</span>
              ))}
              {uniqueVals.length > 30 && (
                <span className="text-[11px] text-gray-400">…共 {uniqueVals.length} 个</span>
              )}
            </div>
          </div>

          {/* Prompt area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-gray-500">分类指令</p>
              {savedPrompts.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowTemplates(o => !o)}
                    className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700"
                  >
                    <BookMarked size={10} />
                    已保存模板
                    <ChevronDown size={10} />
                  </button>
                  {showTemplates && (
                    <div className="absolute right-0 top-5 z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 w-56 space-y-0.5">
                      {savedPrompts.map(p => (
                        <div key={p.id} className="flex items-center gap-1 group">
                          <button
                            onClick={() => { setPrompt(p.prompt); setShowTemplates(false); }}
                            className="flex-1 text-left text-xs px-2 py-1.5 rounded-lg hover:bg-indigo-50 text-gray-700 truncate"
                          >
                            {p.name}
                          </button>
                          <button
                            onClick={() => removeSavedPrompt(p.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="请描述归类规则，例如：将职位归类为 管理层/技术/销售/运营/其他"
              className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-400 resize-none leading-relaxed text-gray-700"
            />
            {showSavePanel ? (
              <div className="mt-1.5">
                <SavePromptPanel prompt={prompt} onClose={() => setShowSavePanel(false)} />
              </div>
            ) : (
              <button
                onClick={() => setShowSavePanel(true)}
                className="mt-1 text-[11px] text-amber-500 hover:text-amber-700"
              >
                + 保存为模板
              </button>
            )}
          </div>

          {/* New field name */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 flex-shrink-0">派生字段名称</span>
            <input
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-indigo-400 text-gray-700"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>
          )}

          {/* Result preview */}
          {mapping && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                映射结果 — {categoryGroups.length} 个类别
              </p>
              {/* Category summary */}
              <div className="flex flex-wrap gap-1 mb-2">
                {categoryGroups.map(([cat, count]) => (
                  <span key={cat} className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">
                    {cat} <span className="text-indigo-300">({count})</span>
                  </span>
                ))}
              </div>
              {/* Sample rows */}
              <div className="border border-gray-100 rounded-xl overflow-hidden text-[11px]">
                <div className="grid grid-cols-2 bg-gray-50 px-3 py-1.5 text-gray-400 font-medium">
                  <span>原始值</span>
                  <span>映射结果</span>
                </div>
                <div className="divide-y divide-gray-50 max-h-36 overflow-y-auto">
                  {Object.entries(mapping).slice(0, 20).map(([orig, mapped]) => (
                    <div key={orig} className="grid grid-cols-2 px-3 py-1.5">
                      <span className="text-gray-500 truncate">{orig}</span>
                      <span className="text-indigo-600 font-medium truncate">{mapped}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={runMapping}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loading ? '处理中…' : '执行 AI 映射'}
          </button>

          <div className="flex-1" />

          <button onClick={onClose} className="text-xs px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100">
            取消
          </button>
          <button
            onClick={createField}
            disabled={!mapping}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Check size={12} />
            创建派生字段
          </button>
        </div>
      </div>
    </div>
  );
}
