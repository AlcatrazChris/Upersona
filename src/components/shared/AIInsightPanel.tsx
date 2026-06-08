'use client';

/**
 * AIInsightPanel — 可嵌入任意视图的 AI 洞察折叠面板
 *
 * 默认折叠，展开后可生成洞察、编辑提示词（仅管理员）、查看缓存结果。
 * 结果通过 onCache 回调由父组件持久化。
 */

import { useState } from 'react';
import {
  Sparkles, ChevronDown, ChevronUp,
  RefreshCw, Loader2, Edit2, Check, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/lib/auth';

// ── Prompt editor ──────────────────────────────────────────────

function PromptEditor({
  prompt, onSave, onClose,
}: {
  prompt:  string;
  onSave:  (p: string) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState(prompt);
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">编辑提示词</span>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X size={13} />
        </button>
      </div>
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        rows={6}
        className="w-full text-xs border border-gray-200 rounded-xl p-3 outline-none focus:border-blue-400 resize-none leading-relaxed text-gray-700 font-mono"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVal(prompt)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          还原
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-xl text-gray-500 hover:bg-gray-200"
        >
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

// ── Result renderer ────────────────────────────────────────────

function InsightResult({ text }: { text: string }) {
  // Parse simple bullet structure
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const blocks: { heading?: string; bullets: string[] }[] = [];
  let cur: { heading?: string; bullets: string[] } = { bullets: [] };

  for (const line of lines) {
    if (/^#{1,3}\s/.test(line) || /^[一二三四五六七八九十\d]+[.、]/.test(line)) {
      if (cur.bullets.length || cur.heading) blocks.push(cur);
      cur = { heading: line.replace(/^#{1,3}\s|^[一二三四五六七八九十\d]+[.、]\s*/, ''), bullets: [] };
    } else if (/^[•·\-*]/.test(line)) {
      cur.bullets.push(line.replace(/^[•·\-*]\s*/, ''));
    } else {
      if (cur.bullets.length === 0 && !cur.heading) {
        cur.heading = line;
      } else {
        cur.bullets.push(line);
      }
    }
  }
  if (cur.bullets.length || cur.heading) blocks.push(cur);

  if (blocks.length <= 1) {
    // Plain text fallback
    return (
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</p>
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <div key={i}>
          {b.heading && (
            <h4 className="text-sm font-semibold text-gray-800 mb-1.5">{b.heading}</h4>
          )}
          {b.bullets.length > 0 && (
            <ul className="space-y-1">
              {b.bullets.map((bullet, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-gray-600 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// ── AIInsightPanel ─────────────────────────────────────────────

export interface AIInsightPanelProps {
  /** 展示在折叠栏上的标签，说明当前分析对象 */
  label:        string;
  /** 用于缓存的唯一 key（由父组件根据当前筛选状态生成） */
  cacheKey:     string;
  /** 缓存的历史结果（来自 viewConfig.insightResults） */
  cachedResult?: string;
  /** 结果生成后回调，供父组件保存到 viewConfig */
  onCache:      (key: string, result: string) => void;
  /** 默认提示词（首次使用） */
  defaultPrompt: string;
  /** 构建 AI 请求的 context（惰性求值，仅在点击生成时调用） */
  buildContext: () => object;
}

export function AIInsightPanel({
  label, cacheKey, cachedResult, onCache, defaultPrompt, buildContext,
}: AIInsightPanelProps) {
  const isAdmin       = useIsAdmin();
  const [expanded,    setExpanded]    = useState(false);
  const [editPrompt,  setEditPrompt]  = useState(false);
  const [prompt,      setPrompt]      = useState(defaultPrompt);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  async function generate(p: string) {
    setLoading(true);
    setError('');
    setExpanded(true);
    try {
      const context = buildContext();
      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ context, question: p }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const { answer } = await res.json();
      onCache(cacheKey, answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn(
      'rounded-2xl border transition-all overflow-hidden',
      expanded
        ? 'bg-white border-blue-100 shadow-sm'
        : 'bg-white border-gray-100 hover:border-blue-100',
    )}>

      {/* ── Toggle bar ── */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-3.5 text-left"
      >
        <Sparkles size={14} className={cn(
          'flex-shrink-0 transition-colors',
          expanded ? 'text-blue-500' : 'text-gray-400',
        )} />
        <span className={cn(
          'text-sm font-medium transition-colors',
          expanded ? 'text-blue-700' : 'text-gray-500',
        )}>
          AI 洞察
        </span>
        {cachedResult && !loading && (
          <span className="text-[10px] text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-md">
            已生成
          </span>
        )}
        <span className="text-[11px] text-gray-400 flex-1 truncate pl-1">
          {label}
        </span>
        {expanded ? (
          <ChevronUp size={13} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* ── Expanded body ── */}
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
            <button
              onClick={() => generate(prompt)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading
                ? <Loader2 size={12} className="animate-spin" />
                : <RefreshCw size={12} />}
              {cachedResult ? '重新生成' : '生成洞察'}
            </button>
          </div>

          {/* Prompt editor */}
          {editPrompt && (
            <PromptEditor
              prompt={prompt}
              onSave={p => { setPrompt(p); generate(p); }}
              onClose={() => setEditPrompt(false)}
            />
          )}

          {/* Error */}
          {error && (
            <div className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin text-blue-400" />
              <p className="text-xs">AI 正在分析数据…</p>
            </div>
          )}

          {/* Result */}
          {!loading && cachedResult && (
            <div className="bg-gray-50 rounded-xl p-4">
              <InsightResult text={cachedResult} />
            </div>
          )}

          {/* Empty state */}
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
