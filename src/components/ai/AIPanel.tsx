'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, AlertCircle, Trash2, Bot, User } from 'lucide-react';
import { buildAIContext } from '@/lib/aiContext';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { cn } from '@/lib/utils';
import type { Dataset } from '@/types/dataSchema';

// ── Types ─────────────────────────────────────────────────────────

interface Message {
  role:    'user' | 'assistant';
  content: string;
}

// ── Suggested questions ───────────────────────────────────────────

const SUGGESTED = [
  '哪个字段的分布最集中？',
  '数据中有哪些值得关注的规律？',
  '哪些字段缺失数据最严重？',
  '请对本数据集做全面分析',
];

const INSIGHT_PROMPT = (name: string) =>
  `请对这份名为"${name}"的数据集进行全面分析，包括：关键字段分布特征、值得关注的规律或异常、数据质量评估。请使用 Markdown 格式输出，结构清晰。`;

// ── Message bubble ────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-3 items-start', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center',
        isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-violet-500 to-blue-500',
      )}>
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot  size={14} className="text-white" />
        }
      </div>

      {/* Content */}
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3',
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-gray-50 border border-gray-100 rounded-tl-sm',
      )}>
        {isUser ? (
          <p className="text-sm leading-relaxed">{msg.content}</p>
        ) : (
          <MarkdownContent content={msg.content} />
        )}
      </div>
    </div>
  );
}

// ── AIPanel ───────────────────────────────────────────────────────

export function AIPanel({ dataset }: { dataset: Dataset }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(userText: string) {
    const text = userText.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const context = buildAIContext(dataset);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          messages: next,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer ?? '（无回答）' }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  function clearHistory() {
    setMessages([]);
    setError('');
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[420px] bg-white rounded-2xl border border-gray-100 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-800">AI 分析助手</span>
            <span className="ml-2 text-xs text-gray-400">{dataset.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => send(INSIGHT_PROMPT(dataset.name))}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-all font-medium"
          >
            <Sparkles size={12} />
            生成洞察
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="清空对话"
              className="p-1.5 rounded-xl text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-300 py-12">
            <Bot size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">点击「生成洞察」获取全面分析，或直接提问</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div role="status" aria-live="polite" className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 size={14} className="animate-spin" />
                <span>分析中…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div role="alert" aria-live="assertive" className="mx-5 mb-2 flex flex-shrink-0 items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={13} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div className="px-5 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {SUGGESTED.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-3.5 border-t border-gray-100 flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题，回车发送…"
          disabled={loading}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50"
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex-shrink-0"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
