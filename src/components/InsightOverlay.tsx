'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Edit3, Save, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRole } from '@/components/RoleProvider';

interface InsightOverlayProps {
  /** AI 缓存的原始 cacheKey（API 返回的 cacheKey） */
  cacheKey: string;
  /** AI 生成的原始内容（ReactNode，可以是文字、卡片、表格等） */
  aiContent: React.ReactNode;
  /** 标题旁的标签文字 */
  label?: string;
  /** 点击「重新生成」时的回调 */
  onRegenerate?: () => void;
  /** AI 正在生成中 */
  loading?: boolean;
  /** AI 内容是否为空（用于空状态提示） */
  hasAiContent?: boolean;
}

export function InsightOverlay({
  cacheKey, aiContent, label, onRegenerate, loading, hasAiContent = true,
}: InsightOverlayProps) {
  const role = useRole();
  const isAdmin = role === 'admin';

  const [customText, setCustomText]   = useState('');
  const [prefer, setPrefer]           = useState<'ai' | 'custom'>('ai');
  const [editing, setEditing]         = useState(false);
  const [draft, setDraft]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [loaded, setLoaded]           = useState(false);

  // ── 加载自定义覆盖数据 ──
  const loadOverride = useCallback(() => {
    if (!cacheKey) return;
    fetch(`/api/insight-content?key=${encodeURIComponent(cacheKey)}`)
      .then(r => r.json())
      .then(d => {
        setCustomText(d.customText ?? '');
        setPrefer(d.prefer ?? 'ai');
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [cacheKey]);

  useEffect(() => { loadOverride(); }, [loadOverride]);

  // ── 保存自定义文本 ──
  async function handleSaveCustom() {
    setSaving(true);
    try {
      const res = await fetch('/api/insight-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheKey, action: 'saveCustom', customText: draft }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCustomText(d.customText ?? draft);
      setPrefer(d.prefer ?? 'custom');
      setEditing(false);
    } catch (e) {
      console.error('保存失败:', e);
    } finally {
      setSaving(false);
    }
  }

  // ── 切换 AI / 自定义 ──
  async function handleTogglePrefer(p: 'ai' | 'custom') {
    if (p === prefer) return;
    try {
      const res = await fetch('/api/insight-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheKey, action: 'savePrefer', prefer: p }),
      });
      const d = await res.json();
      if (res.ok) setPrefer(d.prefer ?? p);
    } catch {}
  }

  const showCustom = prefer === 'custom' && !!customText;

  return (
    <div className="glass-card p-5">
      {/* 头部：标题 + 管理员控制按钮 */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#AF52DE]" />
          <span className="text-[14px] font-600 text-black/70">数据洞察</span>
          {label && <span className="text-[12px] text-black/35">{label}</span>}
          {loaded && !editing && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-500',
              showCustom
                ? 'bg-[#007AFF]/10 text-[#007AFF]'
                : 'bg-[#AF52DE]/10 text-[#AF52DE]'
            )}>
              {showCustom ? '自定义' : 'AI'}
            </span>
          )}
        </div>

        {/* 仅管理员可见的控制按钮 */}
        {isAdmin && !editing && (
          <div className="flex items-center gap-2">
            {/* AI / 自定义切换 */}
            {customText && (
              <div className="flex items-center gap-0.5 glass-card-subtle p-0.5 rounded-ios">
                {(['ai', 'custom'] as const).map(p => (
                  <button key={p} onClick={() => handleTogglePrefer(p)}
                    className={cn(
                      'px-2 py-1 rounded-[6px] text-[11px] font-500 transition-all',
                      prefer === p
                        ? 'bg-white shadow-sm text-black/75'
                        : 'text-black/35 hover:text-black/55'
                    )}>
                    {p === 'ai' ? 'AI' : '自定义'}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => { setDraft(customText); setEditing(true); }}
              className="flex items-center gap-1 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors"
            >
              <Edit3 size={11} />
              编辑
            </button>
            {onRegenerate && (
              <button onClick={onRegenerate} disabled={loading}
                className="flex items-center gap-1 text-[12px] text-black/35 hover:text-[#007AFF] transition-colors disabled:opacity-40">
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                重新生成
              </button>
            )}
          </div>
        )}
      </div>

      {/* 主体内容 */}
      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-black/40 py-3">
          <Loader2 size={13} className="animate-spin" />正在分析…
        </div>
      ) : editing ? (
        /* 编辑模式（仅管理员） */
        <div className="space-y-3">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6}
            className="w-full rounded-ios border border-black/10 bg-white/60 px-3 py-2.5 text-[13px] text-black/70 leading-relaxed resize-y focus:outline-none focus:border-[#007AFF]/40 transition-all"
            placeholder="输入自定义洞察内容…保存后可在 AI / 自定义之间切换" />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-black/30">保存后可在 AI 与自定义之间切换；清空保存则恢复纯 AI 模式</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(false)} className="text-[12px] text-black/35 hover:text-black/60">取消</button>
              <button onClick={handleSaveCustom} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#007AFF] text-white font-500 disabled:opacity-50">
                <Save size={11} />{saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : showCustom ? (
        /* 自定义内容显示 */
        <div>
          {customText.split('\n\n').filter(Boolean).map((p, i) => (
            <p key={i} className="text-[13px] text-black/65 leading-relaxed mb-2">{p.trim()}</p>
          ))}
        </div>
      ) : hasAiContent ? (
        /* AI 内容显示（传入的 ReactNode） */
        aiContent
      ) : (
        /* 空状态 */
        <div className="text-center py-4">
          <p className="text-[13px] text-black/35 mb-2">暂无洞察内容</p>
          <p className="text-[11px] text-black/25">
            {isAdmin ? '点击「重新生成」获取 AI 分析，或点击「编辑」填写自定义内容' : '管理员尚未配置此洞察内容'}
          </p>
        </div>
      )}
    </div>
  );
}
