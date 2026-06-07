'use client';

import { useState } from 'react';
import { Sparkles, Send, Loader2, AlertCircle } from 'lucide-react';
import { buildAIContext } from '@/lib/aiContext';
import type { Dataset } from '@/types/dataSchema';

const SUGGESTED_QUESTIONS = [
  '哪个字段的分布最集中？',
  '数据中有哪些值得关注的规律？',
  '哪些字段缺失数据最严重？',
];

export function AIPanel({ dataset }: { dataset: Dataset }) {
  const [question,        setQuestion]        = useState('');
  const [answer,          setAnswer]          = useState('');
  const [loading,         setLoading]         = useState(false);
  const [insights,        setInsights]        = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error,           setError]           = useState('');

  async function callAI(q: string, setState: (s: string) => void, setLoad: (b: boolean) => void) {
    setLoad(true);
    setError('');
    try {
      const context = buildAIContext(dataset);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, question: q }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setState(data.answer ?? '（无回答）');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoad(false);
    }
  }

  async function generateInsights() {
    await callAI(
      `请对这份名为"${dataset.name}"的数据集进行分析，指出最重要的发现、字段分布特点以及值得关注的洞察。请用中文回答，结构清晰。`,
      setInsights,
      setLoadingInsights,
    );
  }

  async function askQuestion() {
    if (!question.trim()) return;
    await callAI(question, setAnswer, setLoading);
  }

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Auto insights */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-500" />
              <h3 className="font-semibold text-gray-800">AI 数据洞察</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">基于字段统计自动生成分析摘要</p>
          </div>
          <button
            onClick={generateInsights}
            disabled={loadingInsights}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-all"
          >
            {loadingInsights
              ? <><Loader2 size={14} className="animate-spin" />分析中…</>
              : <><Sparkles size={14} />生成洞察</>
            }
          </button>
        </div>
        {insights ? (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-4">
            {insights}
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center py-8">
            点击「生成洞察」让 AI 分析此数据集
          </div>
        )}
      </div>

      {/* Q&A */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-1">问数据</h3>
        <p className="text-xs text-gray-500 mb-4">用自然语言提问，AI 基于真实统计数据作答</p>

        {/* Suggested questions */}
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
            placeholder="输入问题，回车发送…"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          <button
            onClick={askQuestion}
            disabled={loading || !question.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        {answer && (
          <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-4">
            {answer}
          </div>
        )}
      </div>
    </div>
  );
}
