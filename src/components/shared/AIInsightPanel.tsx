'use client';

/**
 * AIInsightPanel — 可嵌入任意视图的 AI 洞察折叠面板
 *
 * - savedPrompt / onPromptSave：让父组件把自定义提示词持久化到 viewConfig，
 *   防止 Tab 切换后组件重新挂载时恢复默认值。
 * - InsightResult：支持 ## 标题、**粗体**、【高亮】、有序/无序列表的渲染。
 */

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, ChevronDown, ChevronUp,
  RefreshCw, Loader2, Edit2, Check, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/lib/auth';

// ── Inline rich-text renderer ─────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // Split by **bold** and 【highlight】 patterns
  const parts = text.split(/(\*\*[^*]+\*\*|【[^】]+】)/);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="font-semibold text-gray-800">{p.slice(2, -2)}</strong>;
        if (p.startsWith('【') && p.endsWith('】'))
          return <span key={i} className="font-semibold text-blue-600">{p.slice(1, -1)}</span>;
        return p;
      })}
    </>
  );
}

// ── Result renderer ───────────────────────────────────────────

function InsightResult({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim());

  type Item =
    | { t: 'h2';      text: string }
    | { t: 'h3';      text: string }
    | { t: 'bullet';  text: string }
    | { t: 'numitem'; n: number; text: string }
    | { t: 'para';    text: string };

  const items: Item[] = lines.map(raw => {
    const l = raw.trim();
    if (/^##\s/.test(l))
      return { t: 'h2',     text: l.replace(/^#+\s*/, '') } as Item;
    if (/^###\s/.test(l) || /^[一二三四五六七八九十]+[.、]/.test(l))
      return { t: 'h3',     text: l.replace(/^###\s*|^[一二三四五六七八九十]+[.、]\s*/, '') } as Item;
    if (/^[•·\-*]\s/.test(l))
      return { t: 'bullet', text: l.replace(/^[•·\-*]\s+/, '') } as Item;
    const nm = l.match(/^(\d+)[.、]\s+([\s\S]+)/);
    if (nm) return { t: 'numitem', n: parseInt(nm[1]), text: nm[2] } as Item;
    return { t: 'para', text: l } as Item;
  });

  // If no structure at all, fall back to plain pre-wrap text
  const hasStructure = items.some(i => i.t !== 'para');
  if (!hasStructure) {
    return <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => {
        if (item.t === 'h2') {
          return (
            <div key={idx} className={cn(idx > 0 && 'mt-4')}>
              <div className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-1 mb-2">
                {renderInline(item.text)}
              </div>
            </div>
          );
        }
        if (item.t === 'h3') {
          return (
            <div key={idx} className={cn(idx > 0 && 'mt-3')}>
              <div className="text-sm font-semibold text-gray-700">{renderInline(item.text)}</div>
            </div>
          );
        }
        if (item.t === 'bullet') {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-[6px]" />
              <span className="text-sm text-gray-600 leading-relaxed">{renderInline(item.text)}</span>
            </div>
          );
        }
        if (item.t === 'numitem') {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {item.n}
              </span>
              <span className="text-sm text-gray-600 leading-relaxed">{renderInline(item.text)}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="text-sm text-gray-600 leading-relaxed pl-1">
            {renderInline(item.text)}
          </p>
        );
      })}
    </div>
  );
}

// ── Prompt editor ─────────────────────────────────────────────

function PromptEditor({
  prompt, defaultPrompt, onSave, onClose,
}: {
  prompt:        string;
  defaultPrompt: string;
  onSave:        (p: string) => void;
  onClose:       () => void;
}) {
  const [val, setVal] = useState(prompt);
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">编辑提示词</span>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        rows={8}
        className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-400 resize-none leading-relaxed text-gray-700 font-mono"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVal(defaultPrompt)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          还原默认
        </button>
        <div className="flex-1" />
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-xl text-gray-500 hover:bg-gray-200">
          取消
        </button>
        <button
          onClick={() => { onSave(val); onClose(); }}
          className="text-xs px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
        >
          <Check size={11} />
          保存并生成
        </button>
      </div>
    </div>
  );
}

// ── AIInsightPanel ────────────────────────────────────────────

export interface AIInsightPanelProps {
  label:          string;
  cacheKey:       string;
  cachedResult?:  string;
  onCache:        (key: string, result: string) => void;
  defaultPrompt:  string;
  /** Persisted custom prompt from viewConfig — survives tab navigation */
  savedPrompt?:   string;
  /** Called when user saves a new prompt so parent can persist it */
  onPromptSave?:  (p: string) => void;
  buildContext:   () => object;
  maxTokens?:     number;
}

export function AIInsightPanel({
  label, cacheKey, cachedResult, onCache,
  defaultPrompt, savedPrompt, onPromptSave, buildContext, maxTokens,
}: AIInsightPanelProps) {
  const isAdmin = useIsAdmin();

  const [expanded,   setExpanded]   = useState(false);
  const [editPrompt, setEditPrompt] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [editResult, setEditResult] = useState(false);
  const [resultDraft, setResultDraft] = useState(cachedResult ?? '');

  useEffect(() => setResultDraft(cachedResult ?? ''), [cachedResult]);

  // Local prompt state initialised from persisted value (or default).
  // Syncs when an external update arrives (e.g. another admin saves a new prompt via cloud).
  const [prompt, setPrompt] = useState(savedPrompt ?? defaultPrompt);
  const prevSavedRef = useRef(savedPrompt);
  useEffect(() => {
    if (savedPrompt !== prevSavedRef.current) {
      prevSavedRef.current = savedPrompt;
      setPrompt(savedPrompt ?? defaultPrompt);
    }
  }, [savedPrompt, defaultPrompt]);

  async function generate(p: string) {
    setLoading(true);
    setError('');
    setExpanded(true);
    try {
      const context = buildContext();
      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ context, question: p, maxTokens }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const { answer } = await res.json();
      onCache(cacheKey, answer);
      setEditResult(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  function handlePromptSave(p: string) {
    setPrompt(p);
    onPromptSave?.(p);
    generate(p);
  }

  return (
    <div className={cn(
      'rounded-2xl border transition-all overflow-hidden',
      expanded ? 'bg-white border-blue-100 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-100',
    )}>

      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-3.5 text-left"
      >
        <Sparkles size={14} className={cn('flex-shrink-0 transition-colors', expanded ? 'text-blue-500' : 'text-gray-400')} />
        <span className={cn('text-sm font-medium transition-colors', expanded ? 'text-blue-700' : 'text-gray-500')}>
          AI 洞察
        </span>
        {cachedResult && !loading && (
          <span className="text-[10px] text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-md">已生成</span>
        )}
        <span className="text-[11px] text-gray-400 flex-1 truncate pl-1">{label}</span>
        {expanded
          ? <ChevronUp size={13} className="text-gray-400 flex-shrink-0" />
          : <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-50">

          {/* Action row */}
          <div className="flex items-center gap-2 pt-3">
            <span className="text-xs text-gray-400 flex-1">{label}</span>
            {isAdmin && (
              <button
                onClick={() => setEditPrompt(o => !o)}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all',
                  editPrompt
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                )}
              >
                <Edit2 size={11} />
                {editPrompt ? '收起提示词' : '编辑提示词'}
              </button>
            )}
            {cachedResult && !loading && (
              <button
                onClick={() => setEditResult(value => !value)}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
                  editResult
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                )}
              >
                <Edit2 size={11} />
                {editResult ? '收起编辑' : '编辑内容'}
              </button>
            )}
            <button
              onClick={() => generate(prompt)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {cachedResult ? '重新生成' : '生成洞察'}
            </button>
          </div>

          {editPrompt && (
            <PromptEditor
              prompt={prompt}
              defaultPrompt={defaultPrompt}
              onSave={handlePromptSave}
              onClose={() => setEditPrompt(false)}
            />
          )}

          {error && (
            <div role="alert" aria-live="assertive" className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
          )}

          {loading && (
            <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 py-8 text-gray-500">
              <Loader2 size={20} className="animate-spin text-blue-400" />
              <p className="text-xs">AI 正在分析数据…</p>
            </div>
          )}

          {!loading && cachedResult && editResult && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-3">
              <textarea
                value={resultDraft}
                onChange={event => setResultDraft(event.target.value)}
                aria-label="编辑 AI 洞察内容"
                className="w-full min-h-72 resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm leading-6 text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setResultDraft(cachedResult); setEditResult(false); }}
                  className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-white"
                >取消</button>
                <button
                  onClick={() => { onCache(cacheKey, resultDraft.trim()); setEditResult(false); }}
                  disabled={!resultDraft.trim()}
                  className="flex items-center gap-1 text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  <Check size={11} />
                  保存内容
                </button>
              </div>
            </div>
          )}

          {!loading && cachedResult && !editResult && (
            <div className="bg-gray-50 rounded-xl p-4">
              <InsightResult text={cachedResult} />
            </div>
          )}

          {!loading && !cachedResult && !error && (
            <div className="text-center py-6 text-gray-400">
              <Sparkles size={20} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">点击「生成洞察」开始 AI 分析</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
