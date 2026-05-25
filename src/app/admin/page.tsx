'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, CheckCircle, AlertCircle, Loader2,
  Database, History, Sparkles, ChevronDown, ChevronUp,
  Save, RotateCcw, Info,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { DataVersion } from '@/types';

interface AiPrompt {
  id: number;
  prompt_key: string;
  prompt_name: string;
  system_hint: string;
  user_prompt: string;
  updated_at: string;
}

interface FieldConfig {
  key: string;
  label: string;
  enabled: boolean;
  type: string;
}

// ── 洞察字段配置面板 ──────────────────────────────────────────
function InsightsFieldPanel({ password, onSaved }: { password: string; onSaved: () => void }) {
  const [fields, setFields]     = useState<FieldConfig[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [status, setStatus]     = useState<'idle'|'ok'|'err'>('idle');

  useEffect(() => {
    fetch('/api/prompts').then(r => r.json()).then((list: AiPrompt[]) => {
      const row = list.find(p => p.prompt_key === 'insights_fields');
      if (row) try { setFields(JSON.parse(row.user_prompt)); } catch {}
    });
  }, []);

  function toggle(key: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ prompt_key: 'insights_fields', user_prompt: JSON.stringify(fields) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setStatus('ok');
      onSaved();
      setTimeout(() => setStatus('idle'), 2000);
    } catch { setStatus('err'); }
    setSaving(false);
  }

  const typeLabels: Record<string, string> = { text: '文本', category: '单选', multi: '多选' };

  return (
    <div className="glass-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/02 transition-colors no-tap"
        onClick={() => setExpanded(p => !p)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
            <Database size={14} className="text-[#007AFF]" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-600 text-black/80">核心洞察分析字段</div>
            <div className="text-[11px] text-black/35 mt-0.5">
              控制哪些字段参与 AI 分析 · 启用 {fields.filter(f=>f.enabled).length}/{fields.length} 个
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-black/30" /> : <ChevronDown size={14} className="text-black/30" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-black/06">
          <div className="text-[11px] text-black/40 mt-3 mb-3">
            开启/关闭字段后点击保存生效。新增字段需先在数据库添加对应列，再在此处添加配置行。
          </div>
          <div className="space-y-1.5">
            {fields.map(f => (
              <div key={f.key}
                className="flex items-center justify-between py-2 px-3 rounded-ios hover:bg-black/03 transition-colors">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggle(f.key)}
                    className={cn('relative rounded-full transition-all duration-200 flex-shrink-0',
                      f.enabled ? 'bg-[#34C759]' : 'bg-black/15')}
                    style={{ width: 30, height: 18 }}>
                    <div className={cn('absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow-sm transition-all duration-200',
                      f.enabled ? 'left-[14px]' : 'left-[2px]')} />
                  </button>
                  <span className={cn('text-[13px]', f.enabled ? 'text-black/70' : 'text-black/35')}>{f.label}</span>
                  <span className="badge-ios badge-gray text-[10px]">{typeLabels[f.type] || f.type}</span>
                </div>
                <span className="text-[11px] text-black/25 font-mono">{f.key}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="text-[12px] text-black/35">
              {status === 'ok' && <span className="text-[#34C759]">✓ 已保存，洞察缓存已清除</span>}
              {status === 'err' && <span className="text-[#FF3B30]">保存失败</span>}
            </div>
            <button onClick={save} disabled={saving}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] font-500 transition-all',
                saving ? 'bg-black/08 text-black/30' : 'bg-[#007AFF] text-white shadow-sm hover:bg-[#0066DD]')}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? '保存中…' : '保存并生效'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 登录门 ────────────────────────────────────────────────────
function LoginGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [pw, setPw] = useState('');
  return (
    <div className="max-w-sm mx-auto mt-20 space-y-4 animate-slide-up">
      <div className="glass-card p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mx-auto mb-6">
          <Database size={24} className="text-[#007AFF]" />
        </div>
        <h2 className="text-[20px] font-700 text-black/80 mb-1">数据管理</h2>
        <p className="text-[13px] text-black/40 mb-6">请输入管理密码继续</p>
        <input type="password" className="input-ios mb-4" placeholder="管理密码"
          value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pw && onAuth(pw)} />
        <button onClick={() => pw && onAuth(pw)} className="btn-ios btn-primary w-full">
          进入管理
        </button>
      </div>
    </div>
  );
}

// ── Prompt 编辑卡片 ───────────────────────────────────────────
function PromptCard({ prompt, password, onSaved }: {
  prompt: AiPrompt;
  password: string;
  onSaved: () => void;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [draft, setDraft]           = useState(prompt.user_prompt);
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg]         = useState('');
  const dirty = draft !== prompt.user_prompt;

  async function handleSave() {
    setSaving(true); setErrMsg('');
    try {
      const res = await fetch('/api/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ prompt_key: prompt.prompt_key, user_prompt: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSaveStatus('ok');
      onSaved();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : '保存失败');
      setSaveStatus('err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/02 transition-colors no-tap"
        onClick={() => setExpanded(p => !p)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#AF52DE]/10 flex items-center justify-center">
            <Sparkles size={14} className="text-[#AF52DE]" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-600 text-black/80">{prompt.prompt_name}</div>
            <div className="text-[11px] text-black/35 mt-0.5">
              {new Date(prompt.updated_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 更新
              {dirty && <span className="ml-2 text-[#FF9500]">· 有未保存修改</span>}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-black/30" /> : <ChevronDown size={14} className="text-black/30" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-black/06">
          {/* 变量说明 */}
          <div className="flex items-start gap-1.5 mt-3 mb-2 text-[11px] text-black/40">
            <Info size={11} className="mt-0.5 flex-shrink-0" />
            <span>可用变量：{prompt.system_hint}</span>
          </div>

          {/* 编辑框 */}
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={16}
            className="w-full rounded-ios border border-black/10 bg-white/60 px-3 py-2.5 text-[12px] text-black/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-[#007AFF]/40 focus:bg-white transition-all"
            style={{ minHeight: 220 }}
          />

          {/* 操作行 */}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => { setDraft(prompt.user_prompt); setSaveStatus('idle'); }}
              disabled={!dirty}
              className="flex items-center gap-1 text-[12px] text-black/35 hover:text-black/60 disabled:opacity-30 transition-colors"
            >
              <RotateCcw size={11} />撤销修改
            </button>

            <div className="flex items-center gap-2">
              {saveStatus === 'ok' && (
                <span className="text-[12px] text-[#34C759] flex items-center gap-1">
                  <CheckCircle size={12} />已保存，洞察缓存已清除
                </span>
              )}
              {saveStatus === 'err' && (
                <span className="text-[12px] text-[#FF3B30]">{errMsg}</span>
              )}
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] font-500 transition-all',
                  dirty && !saving
                    ? 'bg-[#007AFF] text-white shadow-sm hover:bg-[#0066DD]'
                    : 'bg-black/08 text-black/30 cursor-not-allowed'
                )}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? '保存中…' : '保存并生效'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────
export default function AdminPage() {
  const [password, setPassword]   = useState('');
  const [authed, setAuthed]       = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [status, setStatus]       = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadResult, setUploadResult] = useState<{ versionId: number; recordCount: number } | null>(null);
  const [errMsg, setErrMsg]       = useState('');
  const [versions, setVersions]   = useState<DataVersion[]>([]);
  const [prompts, setPrompts]     = useState<AiPrompt[]>([]);
  const [dragging, setDragging]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadVersions = useCallback(() => {
    supabase.from('data_versions').select('*')
      .order('version_id', { ascending: false }).limit(10)
      .then(({ data }) => setVersions((data as DataVersion[]) || []));
  }, []);

  const loadPrompts = useCallback(() => {
    fetch('/api/prompts').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPrompts(d);
    });
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadVersions();
    loadPrompts();
  }, [authed, loadVersions, loadPrompts]);

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading'); setErrMsg('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '上传失败');
      setUploadResult({ versionId: json.versionId, recordCount: json.recordCount });
      setStatus('success');
      setFile(null);
      loadVersions();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : '上传失败');
      setStatus('error');
    }
  }

  if (!authed) return <LoginGate onAuth={pw => { setPassword(pw); setAuthed(true); }} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">

      {/* ── 上传区域 ── */}
      <div className="glass-card p-6">
        <h2 className="text-[17px] font-600 text-black/80 mb-4">上传新数据</h2>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f?.name.endsWith('.xlsx')) setFile(f);
          }}
          className={cn(
            'border-2 border-dashed rounded-ios-xl p-10 text-center cursor-pointer transition-all',
            dragging ? 'border-[#007AFF] bg-[#007AFF]/05'
              : file  ? 'border-[#34C759] bg-[#34C759]/04'
              : 'border-black/12 hover:border-[#007AFF]/40 hover:bg-[#007AFF]/02'
          )}
        >
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)} />
          <Upload size={28} className={cn('mx-auto mb-3', file ? 'text-[#34C759]' : 'text-black/30')} />
          {file ? (
            <>
              <div className="text-[14px] font-600 text-[#34C759]">{file.name}</div>
              <div className="text-[12px] text-black/40 mt-1">{(file.size / 1024).toFixed(1)} KB · 点击重新选择</div>
            </>
          ) : (
            <>
              <div className="text-[14px] text-black/50">将 .xlsx 文件拖到此处</div>
              <div className="text-[12px] text-black/30 mt-1">或点击选择文件</div>
            </>
          )}
        </div>

        <div className="glass-card-subtle p-3 mt-3 text-[12px] text-black/45 space-y-0.5">
          <div>• 文件格式：Excel (.xlsx)，Sheet1 为数据表</div>
          <div>• 上传成功后页面数据将自动刷新，无需手动清除缓存</div>
          <div>• 职业清洗将自动调用 DeepSeek API（同一职业不重复计费）</div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-[12px] text-black/35">已登录 · 数据将完全替换</span>
          <button onClick={handleUpload} disabled={!file || status === 'uploading'}
            className={cn('btn-ios btn-primary', (!file || status === 'uploading') && 'opacity-50 cursor-not-allowed')}>
            {status === 'uploading'
              ? <><Loader2 size={14} className="animate-spin" /> 处理中…</>
              : '开始上传'}
          </button>
        </div>

        {status === 'success' && uploadResult && (
          <div className="mt-3 glass-card-subtle p-3 flex items-center gap-2 border border-[#34C759]/20">
            <CheckCircle size={16} className="text-[#34C759] flex-shrink-0" />
            <span className="text-[13px] text-black/65">
              v{uploadResult.versionId} 已激活，共 {uploadResult.recordCount.toLocaleString()} 条 · 页面已自动刷新
            </span>
          </div>
        )}
        {status === 'error' && (
          <div className="mt-3 glass-card-subtle p-3 flex items-center gap-2 border border-[#FF3B30]/20">
            <AlertCircle size={16} className="text-[#FF3B30] flex-shrink-0" />
            <span className="text-[13px] text-black/65">{errMsg}</span>
          </div>
        )}
      </div>

      {/* ── AI Prompt 管理 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Sparkles size={14} className="text-[#AF52DE]" />
          <h2 className="text-[15px] font-600 text-black/70">AI 洞察 Prompt 管理</h2>
        </div>
        {prompts.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <div className="text-[13px] text-black/35">暂无 Prompt 配置</div>
            <div className="text-[12px] text-black/25 mt-1">
              请先在 Supabase SQL Editor 执行 supabase/add_prompts_table.sql
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <InsightsFieldPanel password={password} onSaved={loadPrompts} />
            {prompts.filter(p => p.prompt_key !== 'insights_fields').map(p => (
              <PromptCard key={p.id} prompt={p} password={password} onSaved={loadPrompts} />
            ))}
          </div>
        )}
      </div>

      {/* ── 版本历史 ── */}
      {versions.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <History size={15} className="text-black/40" />
            <h2 className="text-[15px] font-600 text-black/70">版本历史</h2>
          </div>
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.version_id}
                className={cn('flex items-center justify-between px-3 py-2.5 rounded-ios transition-all',
                  v.is_active ? 'bg-[#007AFF]/06 border border-[#007AFF]/15' : 'hover:bg-black/03')}>
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-2 h-2 rounded-full', v.is_active ? 'bg-[#34C759]' : 'bg-black/15')} />
                  <div>
                    <span className="text-[13px] font-500 text-black/70">v{v.version_id}</span>
                    <span className="text-[12px] text-black/40 ml-2">{v.record_count.toLocaleString()} 条</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.is_active && <span className="badge-ios badge-green">当前</span>}
                  <span className="text-[11px] text-black/35">
                    {new Date(v.uploaded_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
