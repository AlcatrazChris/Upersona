'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, CheckCircle, AlertCircle, Loader2,
  Database, History, Sparkles, ChevronDown, ChevronUp,
  Save, RotateCcw, Info, RefreshCw, Edit3,
  Users, Trash2, UserPlus, Key, Activity, Shield, ShieldOff, LayoutGrid,
  ArrowUp, ArrowDown, Settings2,
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

// ── 概览洞察编辑面板 ─────────────────────────────────────────
function OverviewInsightPanel() {
  const [expanded, setExpanded]         = useState(false);
  const [aiText, setAiText]             = useState('');
  const [customText, setCustomText]     = useState('');
  const [prefer, setPrefer]             = useState<'ai'|'custom'>('ai');
  const [editDraft, setEditDraft]       = useState('');
  const [editing, setEditing]           = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [preferSaving, setPreferSaving] = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');
  const [saveOk, setSaveOk]             = useState(true);

  useEffect(() => {
    if (!expanded) return;
    fetch('/api/status-compare-insight?isOverview=1')
      .then(r => r.json())
      .then(d => {
        setAiText(d.insight ?? '');
        setCustomText(d.custom ?? '');
        setPrefer(d.prefer ?? 'ai');
      });
  }, [expanded]);

  async function regenerate() {
    setRegenLoading(true);
    try {
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOverview: true, forceRegenerate: true, rows: [], globalStatus: [], dimensionLabel: '全维度概览', filter: '全国' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '生成失败');
      setAiText(d.insight ?? '');
    } finally { setRegenLoading(false); }
  }

  async function handleSaveCustom() {
    setSaving(true);
    try {
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOverview: true, saveCustom: true, customText: editDraft, rows: [], globalStatus: [], dimensionLabel: '全维度概览', filter: '全国' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '保存失败');
      setCustomText(d.custom ?? editDraft);
      setPrefer(d.prefer ?? 'custom');
      setEditing(false);
      setSaveOk(true);
      setSaveMsg('已保存自定义内容');
    } catch (e) {
      setSaveOk(false);
      setSaveMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 2500);
    }
  }

  async function handleSavePrefer(p: 'ai'|'custom') {
    if (p === 'custom' && !customText) return;
    setPreferSaving(true);
    try {
      const res = await fetch('/api/status-compare-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOverview: true, savePrefer: true, prefer: p, rows: [], globalStatus: [], dimensionLabel: '全维度概览', filter: '全国' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '切换失败');
      setPrefer(d.prefer ?? p);
      setSaveOk(true);
      setSaveMsg(`已切换为${p === 'ai' ? 'AI内容' : '自定义内容'}`);
    } catch (e) {
      setSaveOk(false);
      setSaveMsg(e instanceof Error ? e.message : '切换失败');
    } finally {
      setPreferSaving(false);
      setTimeout(() => setSaveMsg(''), 2500);
    }
  }

  return (
    <div className="glass-card overflow-hidden">
      <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/02 transition-colors no-tap"
        onClick={() => setExpanded(p => !p)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#AF52DE]/10 flex items-center justify-center">
            <Sparkles size={14} className="text-[#AF52DE]" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-600 text-black/80">概览页数据洞察</div>
            <div className="text-[11px] text-black/35 mt-0.5">
              当前显示：<span className={prefer === 'custom' ? 'text-[#007AFF]' : 'text-[#AF52DE]'}>
                {prefer === 'custom' ? '自定义内容' : 'AI 内容'}
              </span>
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-black/30" /> : <ChevronDown size={14} className="text-black/30" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-black/06 space-y-5">
          {/* 显示切换 */}
          <div className="mt-4">
            <div className="text-[11px] text-black/40 font-500 uppercase tracking-wider mb-2">概览页显示哪个内容</div>
            <div className="flex items-center gap-1 glass-card-subtle p-1 rounded-ios w-fit">
              {(['ai', 'custom'] as const).map(p => (
                <button key={p} onClick={() => handleSavePrefer(p)}
                  disabled={preferSaving || (p === 'custom' && !customText)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-500 transition-all no-tap',
                    prefer === p ? 'bg-white shadow-sm text-black/80' : 'text-black/40 hover:text-black/65',
                    p === 'custom' && !customText && 'opacity-30 cursor-not-allowed')}>
                  {p === 'ai' ? <><Sparkles size={11} className="text-[#AF52DE]" />AI 内容</> : <><Edit3 size={11} className="text-[#007AFF]" />自定义内容</>}
                </button>
              ))}
            </div>
          </div>

          {/* AI 内容 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-black/40 font-500 uppercase tracking-wider">AI 生成内容</span>
              <button onClick={regenerate} disabled={regenLoading}
                className="flex items-center gap-1 text-[11px] text-black/35 hover:text-[#007AFF] transition-colors">
                <RefreshCw size={10} className={regenLoading ? 'animate-spin' : ''} />重新生成
              </button>
            </div>
            <div className="rounded-ios border border-black/08 bg-black/02 px-3 py-2.5 text-[12px] text-black/55 leading-relaxed min-h-[50px]">
              {regenLoading
                ? <span className="flex items-center gap-1.5 text-black/30"><Loader2 size={11} className="animate-spin" />生成中…</span>
                : aiText || <span className="text-black/25 italic">暂无，点击重新生成</span>}
            </div>
          </div>

          {/* 自定义内容 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-black/40 font-500 uppercase tracking-wider">自定义内容</span>
              {!editing && (
                <button onClick={() => { setEditDraft(customText); setEditing(true); }}
                  className="flex items-center gap-1 text-[11px] text-black/35 hover:text-[#007AFF] transition-colors">
                  <Edit3 size={10} />{customText ? '编辑' : '新增'}
                </button>
              )}
            </div>
            {editing ? (
              <div className="space-y-2">
                <textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} rows={5}
                  className="w-full rounded-ios border border-black/10 bg-white/60 px-3 py-2.5 text-[12px] text-black/70 leading-relaxed resize-y focus:outline-none focus:border-[#007AFF]/40 transition-all"
                  placeholder="输入要在概览页展示的文字…" />
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setEditing(false)} className="text-[12px] text-black/35">取消</button>
                  <button onClick={handleSaveCustom} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#007AFF] text-white font-500 disabled:opacity-50">
                    <Save size={11} />{saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </div>
            ) : customText ? (
              <div className="rounded-ios border border-black/08 bg-black/02 px-3 py-2.5 text-[12px] text-black/60 leading-relaxed whitespace-pre-wrap">
                {customText}
              </div>
            ) : (
              <div className="rounded-ios border border-dashed border-black/12 px-3 py-3 text-[12px] text-black/25 text-center">
                暂无自定义内容
              </div>
            )}
          </div>

          {saveMsg && (
            <div className={cn('text-[12px] flex items-center gap-1.5', saveOk ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
              {saveOk ? <CheckCircle size={12} /> : <AlertCircle size={12} />}{saveMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 洞察字段配置面板 ──────────────────────────────────────────
function InsightsFieldPanel({ onSaved }: { onSaved: () => void }) {
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
        headers: { 'Content-Type': 'application/json' },
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
      <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/02 transition-colors no-tap"
        onClick={() => setExpanded(p => !p)}>
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
          <div className="text-[11px] text-black/40 mt-3 mb-3">开启/关闭字段后点击保存生效。</div>
          <div className="space-y-1.5">
            {fields.map(f => (
              <div key={f.key} className="flex items-center justify-between py-2 px-3 rounded-ios hover:bg-black/03 transition-colors">
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
              {status === 'ok' && <span className="text-[#34C759]">✓ 已保存</span>}
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

// ── Prompt 编辑卡片 ───────────────────────────────────────────
function PromptCard({ prompt, onSaved }: { prompt: AiPrompt; onSaved: () => void }) {
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
        headers: { 'Content-Type': 'application/json' },
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
    } finally { setSaving(false); }
  }

  return (
    <div className="glass-card overflow-hidden">
      <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/02 transition-colors no-tap"
        onClick={() => setExpanded(p => !p)}>
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
          <div className="flex items-start gap-1.5 mt-3 mb-2 text-[11px] text-black/40">
            <Info size={11} className="mt-0.5 flex-shrink-0" />
            <span>可用变量：{prompt.system_hint}</span>
          </div>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={16}
            className="w-full rounded-ios border border-black/10 bg-white/60 px-3 py-2.5 text-[12px] text-black/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-[#007AFF]/40 focus:bg-white transition-all"
            style={{ minHeight: 220 }} />
          <div className="flex items-center justify-between mt-3">
            <button onClick={() => { setDraft(prompt.user_prompt); setSaveStatus('idle'); }} disabled={!dirty}
              className="flex items-center gap-1 text-[12px] text-black/35 hover:text-black/60 disabled:opacity-30 transition-colors">
              <RotateCcw size={11} />撤销修改
            </button>
            <div className="flex items-center gap-2">
              {saveStatus === 'ok' && <span className="text-[12px] text-[#34C759] flex items-center gap-1"><CheckCircle size={12} />已保存，缓存已清除</span>}
              {saveStatus === 'err' && <span className="text-[12px] text-[#FF3B30]">{errMsg}</span>}
              <button onClick={handleSave} disabled={!dirty || saving}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[13px] font-500 transition-all',
                  dirty && !saving ? 'bg-[#007AFF] text-white shadow-sm hover:bg-[#0066DD]' : 'bg-black/08 text-black/30 cursor-not-allowed')}>
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

// ── 账号管理 ─────────────────────────────────────────────────
interface Account {
  id: number;
  username: string;
  role: 'admin' | 'client';
  created_at: string;
  updated_at: string;
}

interface LoginLog {
  id: number;
  username: string;
  ip: string | null;
  user_agent: string | null;
  success: boolean;
  logged_at: string;
}

function AccountManager() {
  const [accounts, setAccounts]       = useState<Account[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [newUser, setNewUser]         = useState('');
  const [newPass, setNewPass]         = useState('');
  const [newRole, setNewRole]         = useState<'admin' | 'client'>('client');
  const [creating, setCreating]       = useState(false);
  const [createMsg, setCreateMsg]     = useState('');
  const [createOk, setCreateOk]       = useState(true);
  const [changingPw, setChangingPw]   = useState<number | null>(null);
  const [pwDraft, setPwDraft]         = useState('');
  const [pwSaving, setPwSaving]       = useState(false);
  const [showLogs, setShowLogs]       = useState(false);
  const [logs, setLogs]               = useState<LoginLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      const json = await res.json();
      if (Array.isArray(json)) setAccounts(json);
    } finally { setLoading(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/accounts/logs?limit=50');
      const json = await res.json();
      if (Array.isArray(json)) setLogs(json);
    } finally { setLogsLoading(false); }
  }, []);

  function toggleLogs() {
    const next = !showLogs;
    setShowLogs(next);
    if (next && logs.length === 0) loadLogs();
  }

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  async function handleCreate() {
    if (!newUser.trim() || !newPass.trim()) return;
    setCreating(true); setCreateMsg('');
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUser.trim(), password: newPass.trim(), role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '创建失败');
      setCreateOk(true); setCreateMsg(`账号 "${newUser}" 创建成功`);
      setNewUser(''); setNewPass(''); setShowCreate(false);
      loadAccounts();
    } catch (e) {
      setCreateOk(false); setCreateMsg(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
      setTimeout(() => setCreateMsg(''), 3000);
    }
  }

  async function handleChangePassword(id: number) {
    if (!pwDraft.trim()) return;
    setPwSaving(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password: pwDraft.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '修改失败');
      setChangingPw(null); setPwDraft('');
      setCreateOk(true); setCreateMsg('密码修改成功');
      setTimeout(() => setCreateMsg(''), 3000);
    } catch (e) {
      setCreateOk(false); setCreateMsg(e instanceof Error ? e.message : '修改失败');
      setTimeout(() => setCreateMsg(''), 3000);
    } finally { setPwSaving(false); }
  }

  async function handleDelete(id: number, username: string) {
    if (!confirm(`确定要删除账号 "${username}" 吗？`)) return;
    try {
      const res = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '删除失败');
      loadAccounts();
      setCreateOk(true); setCreateMsg(`账号 "${username}" 已删除`);
      setTimeout(() => setCreateMsg(''), 3000);
    } catch (e) {
      setCreateOk(false); setCreateMsg(e instanceof Error ? e.message : '删除失败');
      setTimeout(() => setCreateMsg(''), 3000);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-[#5856D6]" />
          <h2 className="text-[15px] font-600 text-black/70">账号管理</h2>
          <span className="text-[11px] text-black/30">数据库账号 · 环境变量超管不可修改</span>
        </div>
        <button onClick={() => setShowCreate(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#5856D6]/10 text-[#5856D6] hover:bg-[#5856D6]/18 transition-colors font-500 no-tap">
          <UserPlus size={12} />{showCreate ? '取消' : '新建账号'}
        </button>
      </div>

      {/* 创建表单 */}
      {showCreate && (
        <div className="glass-card-subtle p-4 mb-4 space-y-3 rounded-ios">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-black/40 font-500 mb-1 block">用户名</label>
              <input type="text" value={newUser} onChange={e => setNewUser(e.target.value)}
                placeholder="username"
                className="input-ios text-[13px] py-1.5 w-full" />
            </div>
            <div>
              <label className="text-[11px] text-black/40 font-500 mb-1 block">密码</label>
              <input type="text" value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder="password"
                className="input-ios text-[13px] py-1.5 w-full" />
            </div>
            <div>
              <label className="text-[11px] text-black/40 font-500 mb-1 block">角色</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'client')}
                className="input-ios text-[13px] py-1.5 w-full">
                <option value="client">客户 (client)</option>
                <option value="admin">管理员 (admin)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleCreate} disabled={creating || !newUser.trim() || !newPass.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#5856D6] text-white font-500 disabled:opacity-50 no-tap">
              {creating ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
              {creating ? '创建中…' : '创建'}
            </button>
          </div>
        </div>
      )}

      {/* 账号列表 */}
      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-black/40 py-4">
          <Loader2 size={13} className="animate-spin" />加载中…
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-[13px] text-black/35 text-center py-4">
          暂无数据库账号。使用上方「新建账号」创建。
        </div>
      ) : (
        <div className="space-y-1.5">
          {accounts.map(acc => (
            <div key={acc.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-ios hover:bg-black/03 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-600',
                  acc.role === 'admin' ? 'bg-[#FF9500]/12 text-[#FF9500]' : 'bg-[#007AFF]/10 text-[#007AFF]')}>
                  {acc.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-[13px] font-500 text-black/70">{acc.username}</div>
                  <div className="text-[11px] text-black/35">
                    {acc.role === 'admin' ? '管理员' : '客户'} ·
                    创建于 {new Date(acc.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {changingPw === acc.id ? (
                  <div className="flex items-center gap-1.5">
                    <input type="text" value={pwDraft} onChange={e => setPwDraft(e.target.value)}
                      placeholder="新密码" className="input-ios text-[12px] py-1 w-[120px]" />
                    <button onClick={() => handleChangePassword(acc.id)} disabled={pwSaving || !pwDraft.trim()}
                      className="text-[11px] text-[#007AFF] font-500 disabled:opacity-50">
                      {pwSaving ? '…' : '确定'}
                    </button>
                    <button onClick={() => { setChangingPw(null); setPwDraft(''); }}
                      className="text-[11px] text-black/35">取消</button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => { setChangingPw(acc.id); setPwDraft(''); }}
                      className="flex items-center gap-1 text-[11px] text-black/35 hover:text-[#007AFF] transition-colors no-tap">
                      <Key size={10} />改密
                    </button>
                    <button onClick={() => handleDelete(acc.id, acc.username)}
                      className="flex items-center gap-1 text-[11px] text-black/35 hover:text-[#FF3B30] transition-colors no-tap">
                      <Trash2 size={10} />删除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 状态消息 */}
      {createMsg && (
        <div className={cn('mt-3 text-[12px] flex items-center gap-1.5',
          createOk ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
          {createOk ? <CheckCircle size={12} /> : <AlertCircle size={12} />}{createMsg}
        </div>
      )}

      {/* 登录日志折叠区 */}
      <div className="mt-4 border-t border-black/06 pt-3">
        <button onClick={toggleLogs}
          className="flex items-center gap-2 text-[12px] text-black/40 hover:text-black/65 transition-colors no-tap w-full">
          <Activity size={12} />
          <span className="font-500">登录记录</span>
          <span className="text-[11px] text-black/25">（最近50次，含各设备IP）</span>
          <ChevronDown size={11} className={cn('ml-auto transition-transform', showLogs && 'rotate-180')} />
        </button>

        {showLogs && (
          <div className="mt-3">
            <div className="flex justify-end mb-2">
              <button onClick={loadLogs} disabled={logsLoading}
                className="flex items-center gap-1 text-[11px] text-black/35 hover:text-[#007AFF] transition-colors">
                <RefreshCw size={10} className={logsLoading ? 'animate-spin' : ''} />刷新
              </button>
            </div>
            {logsLoading ? (
              <div className="flex items-center gap-2 text-[12px] text-black/35 py-3">
                <Loader2 size={12} className="animate-spin" />加载中…
              </div>
            ) : logs.length === 0 ? (
              <div className="text-[12px] text-black/30 text-center py-3">
                暂无记录（需先执行 add_login_logs_table.sql）
              </div>
            ) : (
              <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-ios hover:bg-black/02 transition-colors text-[11px]">
                    {log.success
                      ? <Shield size={10} className="text-[#34C759] flex-shrink-0" />
                      : <ShieldOff size={10} className="text-[#FF3B30] flex-shrink-0" />}
                    <span className={cn('font-500 w-20 truncate flex-shrink-0',
                      log.success ? 'text-black/65' : 'text-[#FF3B30]/70')}>
                      {log.username}
                    </span>
                    <span className="text-[#007AFF]/70 font-mono w-28 truncate flex-shrink-0">{log.ip || '—'}</span>
                    <span className="text-black/30 flex-1 truncate hidden sm:block">
                      {log.user_agent ? log.user_agent.slice(0, 60) : '—'}
                    </span>
                    <span className="text-black/30 flex-shrink-0 tabular-nums">
                      {new Date(log.logged_at).toLocaleString('zh-CN', {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 版本历史（含删除）────────────────────────────────────────
function VersionHistory({ versions, onDeleted }: { versions: DataVersion[]; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState<number | null>(null);
  const [msg, setMsg]           = useState('');
  const [msgOk, setMsgOk]       = useState(true);

  function versionName(v: DataVersion) {
    return v.version_name || v.notes || '';
  }

  async function handleSaveName(v: DataVersion) {
    setSavingName(v.version_id);
    try {
      const res = await fetch('/api/versions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: v.version_id, versionName: nameDraft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存失败');
      setMsgOk(true); setMsg(`v${v.version_id} 名称已保存`);
      setEditingId(null);
      onDeleted();
    } catch (e) {
      setMsgOk(false); setMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingName(null);
      setTimeout(() => setMsg(''), 3000);
    }
  }

  async function handleDelete(v: DataVersion) {
    if (!confirm(`确定要删除 v${v.version_id}（${v.record_count.toLocaleString()} 条数据）？\n该操作不可逆，相关用户数据和 AI 缓存将一并清除。`)) return;
    setDeleting(v.version_id);
    try {
      const res = await fetch('/api/versions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: v.version_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '删除失败');
      setMsgOk(true); setMsg(`v${v.version_id} 已删除`);
      onDeleted();
    } catch (e) {
      setMsgOk(false); setMsg(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(null);
      setTimeout(() => setMsg(''), 4000);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History size={15} className="text-black/40" />
          <h2 className="text-[15px] font-600 text-black/70">版本历史</h2>
          <span className="text-[11px] text-black/30">可修改名称，非活跃版本可删除</span>
        </div>
      </div>
      <div className="space-y-2">
        {versions.map(v => {
          const displayName = versionName(v);
          const isEditing = editingId === v.version_id;
          return (
          <div key={v.version_id}
            className={cn('flex items-center justify-between px-3 py-2.5 rounded-ios transition-all',
              v.is_active ? 'bg-[#007AFF]/06 border border-[#007AFF]/15' : 'hover:bg-black/03')}>
            <div className="flex items-center gap-2.5">
              <div className={cn('w-2 h-2 rounded-full', v.is_active ? 'bg-[#34C759]' : 'bg-black/15')} />
              <div>
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                      maxLength={60}
                      placeholder={`v${v.version_id}`}
                      className="input-ios text-[12px] py-1 w-[180px]"
                    />
                    <button onClick={() => handleSaveName(v)} disabled={savingName === v.version_id}
                      className="flex items-center gap-1 text-[11px] text-[#007AFF] font-500 disabled:opacity-50">
                      {savingName === v.version_id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                      保存
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-[11px] text-black/35">取消</button>
                  </div>
                ) : (
                  <>
                    <span className="text-[13px] font-500 text-black/70">{displayName || `v${v.version_id}`}</span>
                    <span className="text-[11px] text-black/30 ml-2">v{v.version_id}</span>
                    <span className="text-[12px] text-black/40 ml-2">{v.record_count.toLocaleString()} 条</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {v.is_active && <span className="badge-ios badge-green">当前</span>}
              <span className="text-[11px] text-black/35">
                {new Date(v.uploaded_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              {!isEditing && (
                <button onClick={() => { setEditingId(v.version_id); setNameDraft(displayName); }}
                  className="flex items-center gap-1 text-[11px] text-black/25 hover:text-[#007AFF] transition-colors no-tap">
                  <Edit3 size={10} />改名
                </button>
              )}
              {!v.is_active && (
                <button onClick={() => handleDelete(v)} disabled={deleting === v.version_id}
                  className="flex items-center gap-1 text-[11px] text-black/25 hover:text-[#FF3B30] transition-colors no-tap disabled:opacity-40">
                  {deleting === v.version_id
                    ? <Loader2 size={10} className="animate-spin" />
                    : <Trash2 size={10} />}
                  删除
                </button>
              )}
            </div>
          </div>
        );})}
      </div>
      {msg && (
        <div className={cn('mt-3 text-[12px] flex items-center gap-1.5',
          msgOk ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
          {msgOk ? <CheckCircle size={12} /> : <AlertCircle size={12} />}{msg}
        </div>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────

// ── 数据字段配置 ──────────────────────────────────────────────
interface DimConfigRow {
  dim_key: string; label: string; is_ordered: boolean; is_multi_select: boolean;
  ordered_values?: string[] | null; note?: string | null; field_type: string;
  enabled_profile: boolean; enabled_insight: boolean; sort_order: number;
  chart_type?: string;  // 'bar' | 'pie'
  group_name?: string;  // 分组标签
}

function DimensionsConfigPanel() {
  const [dims, setDims]           = useState<DimConfigRow[]>([]);
  const [expanded, setExpanded]   = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const [saving, setSaving]       = useState<string | null>(null);
  const [msg, setMsg]             = useState('');
  const [msgOk, setMsgOk]         = useState(true);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft]     = useState('');
  const [showAdd, setShowAdd]     = useState(false);
  const [newField, setNewField]   = useState({ dim_key: '', label: '', is_ordered: false, is_multi_select: false, field_type: 'category' });
  const [adding, setAdding]       = useState(false);
  // 字段高级设置（备注/分组/图表类型/有序值）
  const [expandedSettings, setExpandedSettings] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<{
    note: string; groupName: string; chartType: string; orderedValues: string; isDirty: boolean;
  }>({ note: '', groupName: '', chartType: 'bar', orderedValues: '', isDirty: false });

  // 从 API 加载（兼容 camelCase DimensionConfig 和 snake_case DB 格式）
  const load = () => {
    fetch('/api/dimensions').then(r => r.json()).then((raw: unknown) => {
      if (!Array.isArray(raw)) return;
      const rows: DimConfigRow[] = (raw as Record<string, unknown>[]).map(x => ({
        dim_key:         String(x.dim_key         ?? x.key          ?? ''),
        label:           String(x.label           ?? ''),
        is_ordered:      Boolean(x.is_ordered     ?? x.isOrdered    ?? false),
        is_multi_select: Boolean(x.is_multi_select ?? x.isMultiSelect ?? false),
        ordered_values:  (x.ordered_values        ?? x.orderedValues ?? null) as string[] | null,
        note:            (x.note                  ?? null)           as string | null,
        field_type:      String(x.field_type      ?? x.fieldType    ?? 'category'),
        enabled_profile: x.enabled_profile !== undefined ? Boolean(x.enabled_profile)
                       : x.enabledProfile  !== undefined ? Boolean(x.enabledProfile) : true,
        enabled_insight: x.enabled_insight !== undefined ? Boolean(x.enabled_insight)
                       : x.enabledInsight  !== undefined ? Boolean(x.enabledInsight) : true,
        sort_order:      Number(x.sort_order      ?? x.sortOrder    ?? 0),
        chart_type:      String(x.chart_type      ?? x.chartType    ?? 'bar'),
        group_name:      String(x.group_name      ?? x.groupName    ?? ''),
      }));
      setDims(rows);
    }).catch(() => {});
  };
  useEffect(() => { if (expanded && !loaded) { load(); setLoaded(true); } }, [expanded, loaded]);

  async function toggle(dimKey: string, field: string) {
    const prev = dims;
    const updated = dims.map(d => d.dim_key === dimKey
      ? { ...d, [field]: !(d as unknown as Record<string, unknown>)[field] } : d);
    setDims(updated);
    setSaving(dimKey + ':' + field);
    try {
      const item = updated.find(d => d.dim_key === dimKey)!;
      const res = await fetch('/api/dimensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions: [{ dim_key: dimKey, enabled_profile: item.enabled_profile, enabled_insight: item.enabled_insight }] }),
      });
      if (!res.ok) throw new Error('Failed');
      setMsgOk(true); setMsg('已保存');
    } catch {
      setDims(prev); setMsgOk(false); setMsg('保存失败');
    }
    setSaving(null); setTimeout(() => setMsg(''), 2500);
  }

  async function saveLabel(dimKey: string) {
    if (!labelDraft.trim()) { setEditingLabel(null); return; }
    const updated = dims.map(d => d.dim_key === dimKey ? { ...d, label: labelDraft.trim() } : d);
    setDims(updated); setEditingLabel(null); setSaving(dimKey + ':label');
    try {
      const res = await fetch('/api/dimensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions: [{ dim_key: dimKey, label: labelDraft.trim() }] }),
      });
      if (!res.ok) throw new Error('Failed');
      setMsgOk(true); setMsg('名称已保存');
    } catch {
      setMsgOk(false); setMsg('保存失败');
    }
    setSaving(null); setTimeout(() => setMsg(''), 2500);
  }

  // 打开 / 关闭高级设置面板
  function openSettings(d: DimConfigRow) {
    if (expandedSettings === d.dim_key) {
      setExpandedSettings(null);
    } else {
      setExpandedSettings(d.dim_key);
      setSettingsDraft({
        note:          d.note || '',
        groupName:     d.group_name || '',
        chartType:     d.is_multi_select ? 'bar' : (d.chart_type || 'bar'),
        orderedValues: (d.ordered_values || []).join('\n'),
        isDirty:       false,
      });
    }
  }

  async function saveSettings(dimKey: string) {
    const dim = dims.find(d => d.dim_key === dimKey);
    if (!dim) return;
    setSaving(dimKey + ':settings');
    try {
      const payload: Record<string, unknown> = {
        dim_key:    dimKey,
        note:       settingsDraft.note.trim() || null,
        group_name: settingsDraft.groupName.trim(),
        chart_type: settingsDraft.chartType,
      };
      if (dim.is_ordered) {
        const vals = settingsDraft.orderedValues.split('\n').map(s => s.trim()).filter(Boolean);
        payload.ordered_values = vals.length > 0 ? vals : null;
      }
      const res = await fetch('/api/dimensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions: [payload] }),
      });
      if (!res.ok) throw new Error('Failed');
      setDims(prev => prev.map(d => {
        if (d.dim_key !== dimKey) return d;
        const next: DimConfigRow = {
          ...d,
          note:       settingsDraft.note.trim() || null,
          group_name: settingsDraft.groupName.trim(),
          chart_type: settingsDraft.chartType,
        };
        if (dim.is_ordered) {
          const vals = settingsDraft.orderedValues.split('\n').map(s => s.trim()).filter(Boolean);
          next.ordered_values = vals.length > 0 ? vals : null;
        }
        return next;
      }));
      setSettingsDraft(prev => ({ ...prev, isDirty: false }));
      setMsgOk(true); setMsg('设置已保存');
    } catch {
      setMsgOk(false); setMsg('保存失败，请确认已执行 add_dim_extra_fields.sql');
    }
    setSaving(null); setTimeout(() => setMsg(''), 3000);
  }

  async function handleAdd() {
    if (!newField.dim_key.trim() || !newField.label.trim()) return;
    setAdding(true);
    try {
      const fieldType = newField.is_multi_select ? 'multi' : newField.field_type;
      const res = await fetch('/api/dimensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: [{
            dim_key: newField.dim_key.trim(),
            label: newField.label.trim(),
            is_ordered: newField.is_ordered,
            is_multi_select: newField.is_multi_select,
            field_type: fieldType,
            enabled_profile: true,
            enabled_insight: true,
            sort_order: (dims.length + 1) * 10,
          }],
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setMsgOk(true); setMsg('字段已添加');
      setShowAdd(false);
      setNewField({ dim_key: '', label: '', is_ordered: false, is_multi_select: false, field_type: 'category' });
      load();
    } catch {
      setMsgOk(false); setMsg('添加失败，Key 可能已存在');
    }
    setAdding(false); setTimeout(() => setMsg(''), 3000);
  }

  async function handleReorder(dimKey: string, direction: 'up' | 'down') {
    setExpandedSettings(null); // 排序时关闭展开的设置面板
    const idx = dims.findIndex(d => d.dim_key === dimKey);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === dims.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const next = [...dims];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const withOrder = next.map((d, i) => ({ ...d, sort_order: (i + 1) * 10 }));
    setDims(withOrder);
    setSaving('reorder');
    try {
      const res = await fetch('/api/dimensions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions: withOrder.map(d => ({ dim_key: d.dim_key, sort_order: d.sort_order })) }),
      });
      if (!res.ok) throw new Error('Failed');
      setMsgOk(true); setMsg('顺序已保存');
    } catch {
      setMsgOk(false); setMsg('保存失败');
    }
    setSaving(null); setTimeout(() => setMsg(''), 1800);
  }

  async function handleDelete(dimKey: string, label: string) {
    if (!confirm(`确定要删除字段「${label}」？\n此操作不可撤销，字段配置将永久移除，数据本身不受影响。`)) return;
    setSaving(dimKey + ':delete');
    try {
      const res = await fetch('/api/dimensions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dim_key: dimKey }),
      });
      if (!res.ok) throw new Error('Failed');
      setMsgOk(true); setMsg(`「${label}」已删除`);
      setDims(prev => prev.filter(d => d.dim_key !== dimKey));
      if (expandedSettings === dimKey) setExpandedSettings(null);
    } catch {
      setMsgOk(false); setMsg('操作失败');
    }
    setSaving(null); setTimeout(() => setMsg(''), 2500);
  }

  const activeDims = dims.filter(d => d.enabled_profile !== false || d.enabled_insight !== false);

  return (
    <div className="glass-card overflow-hidden">
      <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/02 transition-colors no-tap"
        onClick={() => setExpanded(p => !p)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
            <LayoutGrid size={14} className="text-[#34C759]" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-600 text-black/80">数据字段管理</div>
            <div className="text-[11px] text-black/35 mt-0.5">画像 / 洞察维度配置 · 共启用 {activeDims.length}/{dims.length} 个</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-black/30" /> : <ChevronDown size={14} className="text-black/30" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-black/06">
          <div className="text-[11px] text-black/40 mt-3 mb-3">
            点击字段名可改名；<span className="text-[#007AFF]">⚙</span> 设置备注/分组/图表类型/有序值；↑↓ 调整顺序。
            <span className="text-[#FF9500] ml-1">「删除」将永久移除字段配置（数据不受影响）。</span>
          </div>

          {/* 新增字段 */}
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-[12px] text-[#007AFF] hover:text-[#0066DD] transition-colors mb-3 no-tap">
              + 新增字段
            </button>
          ) : (
            <div className="glass-card-subtle p-3 rounded-ios mb-3 space-y-2.5 border border-[#007AFF]/15">
              <div className="text-[11px] font-500 text-black/50 mb-1">新增字段</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-black/40 block mb-1">字段 Key（英文，需与数据列名一致）</label>
                  <input value={newField.dim_key} onChange={e => setNewField({ ...newField, dim_key: e.target.value })}
                    placeholder="例: purchase_power" className="input-ios text-[12px] py-1.5 w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-black/40 block mb-1">字段中文名</label>
                  <input value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })}
                    placeholder="例: 购买力" className="input-ios text-[12px] py-1.5 w-full" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-black/40 block mb-1">字段类型</label>
                  <select value={newField.field_type}
                    onChange={e => setNewField({ ...newField, field_type: e.target.value, is_multi_select: e.target.value === 'multi', is_ordered: e.target.value === 'ordered' })}
                    className="input-ios text-[12px] py-1.5 w-full">
                    <option value="category">单选（无序）</option>
                    <option value="ordered">单选（有序）</option>
                    <option value="multi">多选</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <button onClick={() => { setShowAdd(false); setNewField({ dim_key: '', label: '', is_ordered: false, is_multi_select: false, field_type: 'category' }); }}
                    className="text-[12px] text-black/35 hover:text-black/55 transition-colors">取消</button>
                  <button onClick={handleAdd} disabled={adding || !newField.dim_key.trim() || !newField.label.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#007AFF] text-white font-500 disabled:opacity-50 no-tap">
                    {adding ? <Loader2 size={11} className="animate-spin" /> : null}
                    {adding ? '添加中…' : '确认添加'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 字段列表 */}
          <div className="space-y-0.5">
            {dims.map(d => (
              <div key={d.dim_key}
                className={cn('rounded-ios border-b border-black/04 last:border-0 transition-opacity',
                  d.enabled_profile === false && d.enabled_insight === false && 'opacity-40')}>

                {/* ── 主行 ── */}
                <div className="flex items-center justify-between py-2.5 px-3 hover:bg-black/02 transition-colors rounded-ios">
                  {/* 左侧：名称 + 类型 + key */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {editingLabel === d.dim_key ? (
                      <div className="flex items-center gap-1.5">
                        <input value={labelDraft} onChange={e => setLabelDraft(e.target.value)} maxLength={20}
                          className="input-ios text-[12px] py-1 w-[140px]"
                          onKeyDown={e => { if (e.key === 'Enter') saveLabel(d.dim_key); if (e.key === 'Escape') setEditingLabel(null); }} />
                        <button onClick={() => saveLabel(d.dim_key)} className="text-[11px] text-[#007AFF] font-500">保存</button>
                        <button onClick={() => setEditingLabel(null)} className="text-[11px] text-black/35">取消</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingLabel(d.dim_key); setLabelDraft(d.label); }}
                        className={cn('text-[13px] text-left truncate max-w-[130px] hover:text-[#007AFF] transition-colors',
                          d.enabled_profile === false && d.enabled_insight === false ? 'text-black/25' : 'text-black/70')}>
                        {d.label}
                      </button>
                    )}
                    <span className="badge-ios badge-gray text-[10px] flex-shrink-0">
                      {d.is_multi_select ? '多选' : d.is_ordered ? '有序' : '单选'}
                    </span>
                    {d.group_name && (
                      <span className="text-[10px] text-[#5856D6]/70 bg-[#5856D6]/08 rounded px-1.5 py-0.5 flex-shrink-0 hidden sm:inline">
                        {d.group_name}
                      </span>
                    )}
                    <span className="text-[10px] text-black/20 font-mono truncate hidden sm:block">{d.dim_key}</span>
                  </div>

                  {/* 右侧：排序 / 开关 / 设置 / 删除 */}
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {/* 排序箭头 */}
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => handleReorder(d.dim_key, 'up')}
                        disabled={saving === 'reorder' || dims.indexOf(d) === 0}
                        className="text-black/20 hover:text-[#007AFF] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                        <ArrowUp size={11} />
                      </button>
                      <button onClick={() => handleReorder(d.dim_key, 'down')}
                        disabled={saving === 'reorder' || dims.indexOf(d) === dims.length - 1}
                        className="text-black/20 hover:text-[#007AFF] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                        <ArrowDown size={11} />
                      </button>
                    </div>
                    {/* 画像/洞察开关 */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-black/30">画像</span>
                      <button onClick={() => toggle(d.dim_key, 'enabled_profile')}
                        disabled={saving === (d.dim_key + ':enabled_profile')}
                        className={cn('relative rounded-full transition-all duration-200 flex-shrink-0',
                          d.enabled_profile !== false ? 'bg-[#007AFF]' : 'bg-black/15')}
                        style={{ width: 28, height: 16 }}>
                        <div className={cn('absolute top-[1.5px] w-[13px] h-[13px] bg-white rounded-full shadow-sm transition-all duration-200',
                          d.enabled_profile !== false ? 'left-[13.5px]' : 'left-[1.5px]')} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-black/30">洞察</span>
                      <button onClick={() => toggle(d.dim_key, 'enabled_insight')}
                        disabled={saving === (d.dim_key + ':enabled_insight')}
                        className={cn('relative rounded-full transition-all duration-200 flex-shrink-0',
                          d.enabled_insight !== false ? 'bg-[#AF52DE]' : 'bg-black/15')}
                        style={{ width: 28, height: 16 }}>
                        <div className={cn('absolute top-[1.5px] w-[13px] h-[13px] bg-white rounded-full shadow-sm transition-all duration-200',
                          d.enabled_insight !== false ? 'left-[13.5px]' : 'left-[1.5px]')} />
                      </button>
                    </div>
                    {/* ⚙ 高级设置 */}
                    <button onClick={() => openSettings(d)}
                      className={cn('p-1 rounded transition-colors no-tap',
                        expandedSettings === d.dim_key
                          ? 'text-[#007AFF] bg-[#007AFF]/08'
                          : 'text-black/20 hover:text-[#007AFF]')}>
                      <Settings2 size={12} />
                    </button>
                    {/* 删除 */}
                    <button onClick={() => handleDelete(d.dim_key, d.label)}
                      disabled={saving === (d.dim_key + ':delete')}
                      className="text-black/20 hover:text-[#FF3B30] transition-colors disabled:opacity-40 no-tap">
                      {saving === (d.dim_key + ':delete')
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>

                {/* ── 高级设置面板（展开） ── */}
                {expandedSettings === d.dim_key && (
                  <div className="mx-3 mb-2.5 px-3 pt-3 pb-3 bg-[#007AFF]/03 rounded-ios border border-[#007AFF]/10 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* 字段备注 */}
                      <div>
                        <label className="text-[10px] text-black/40 font-500 block mb-1">字段备注</label>
                        <input
                          value={settingsDraft.note}
                          onChange={e => setSettingsDraft(p => ({ ...p, note: e.target.value, isDirty: true }))}
                          placeholder="图表标题下方说明文字"
                          className="input-ios text-[11px] py-1.5 w-full"
                        />
                      </div>
                      {/* 所属分组 */}
                      <div>
                        <label className="text-[10px] text-black/40 font-500 block mb-1">所属分组</label>
                        <input
                          value={settingsDraft.groupName}
                          onChange={e => setSettingsDraft(p => ({ ...p, groupName: e.target.value, isDirty: true }))}
                          placeholder="如：基本信息、消费行为"
                          className="input-ios text-[11px] py-1.5 w-full"
                        />
                      </div>
                    </div>

                    {/* 图表类型（仅非多选维度） */}
                    {!d.is_multi_select && (
                      <div>
                        <label className="text-[10px] text-black/40 font-500 block mb-1">图表类型</label>
                        <div className="flex gap-1.5">
                          {[{ v: 'bar', l: '条形图' }, { v: 'pie', l: '饼图' }].map(opt => (
                            <button key={opt.v}
                              onClick={() => setSettingsDraft(p => ({ ...p, chartType: opt.v, isDirty: true }))}
                              className={cn(
                                'flex-1 py-1.5 rounded-ios text-[11px] border transition-all no-tap',
                                settingsDraft.chartType === opt.v
                                  ? 'border-[#007AFF]/40 bg-[#007AFF]/08 text-[#007AFF] font-500'
                                  : 'border-black/08 text-black/45 hover:bg-black/03',
                              )}>
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 有序值（仅有序维度） */}
                    {d.is_ordered && (
                      <div>
                        <label className="text-[10px] text-black/40 font-500 block mb-1">
                          有序值排列 <span className="text-black/25">（一行一个，从高到低）</span>
                        </label>
                        <textarea
                          value={settingsDraft.orderedValues}
                          onChange={e => setSettingsDraft(p => ({ ...p, orderedValues: e.target.value, isDirty: true }))}
                          rows={4}
                          placeholder={'50岁以上\n45-49岁\n40-44岁\n…'}
                          className="w-full rounded-ios border border-black/10 bg-white/60 px-2.5 py-2 text-[11px] text-black/70 resize-y focus:outline-none focus:border-[#007AFF]/40 transition-all"
                        />
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center justify-between pt-0.5">
                      <button onClick={() => setExpandedSettings(null)}
                        className="text-[11px] text-black/35 hover:text-black/55 transition-colors">
                        关闭
                      </button>
                      <button
                        onClick={() => saveSettings(d.dim_key)}
                        disabled={!settingsDraft.isDirty || saving === (d.dim_key + ':settings')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[11px] font-500 transition-all no-tap',
                          settingsDraft.isDirty && saving !== (d.dim_key + ':settings')
                            ? 'bg-[#007AFF] text-white'
                            : 'bg-black/06 text-black/30 cursor-not-allowed',
                        )}>
                        {saving === (d.dim_key + ':settings')
                          ? <Loader2 size={10} className="animate-spin" />
                          : <Save size={10} />}
                        保存设置
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {msg && (
            <div className={cn('mt-3 text-[12px] flex items-center gap-1.5', msgOk ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
              {msgOk ? <CheckCircle size={12} /> : <AlertCircle size={12} />}{msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



export default function AdminPage() {
  const [file, setFile]           = useState<File | null>(null);
  const [status, setStatus]       = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadResult, setUploadResult] = useState<{
    versionId: number; recordCount: number;
    hasCityTier?: boolean; cleaning?: { message: string };
  } | null>(null);
  const [backfilling, setBackfilling]  = useState(false);
  const [backfillMsg, setBackfillMsg]  = useState('');
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
    loadVersions();
    loadPrompts();
  }, [loadVersions, loadPrompts]);

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading'); setErrMsg('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '上传失败');
      setUploadResult({ versionId: json.versionId, recordCount: json.recordCount, hasCityTier: json.hasCityTier, cleaning: json.cleaning });
      setBackfillMsg(''); // 重置回填状态
      setStatus('success');
      setFile(null);
      loadVersions();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : '上传失败');
      setStatus('error');
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">

      {/* 账号管理 */}
      <AccountManager />

      {/* 上传区域 */}
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
          )}>
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
          <div>• 自动清洗：年龄段/学历/家庭结构/收入/增换购等字段规范化（含AI兜底）</div>
          <div>• 自动计算城市级别（需先在 Supabase 执行 <code className="text-[11px] bg-black/06 px-1 rounded">add_city_tier.sql</code>）</div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-[12px] text-black/35">已登录为管理员 · 数据将完全替换</span>
          <button onClick={handleUpload} disabled={!file || status === 'uploading'}
            className={cn('btn-ios btn-primary', (!file || status === 'uploading') && 'opacity-50 cursor-not-allowed')}>
            {status === 'uploading' ? <><Loader2 size={14} className="animate-spin" /> 处理中…</> : '开始上传'}
          </button>
        </div>

        {status === 'success' && uploadResult && (
          <div className="mt-3 glass-card-subtle p-3 space-y-2 border border-[#34C759]/20">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-[#34C759] flex-shrink-0" />
              <span className="text-[13px] text-black/65">v{uploadResult.versionId} 已激活，共 {uploadResult.recordCount.toLocaleString()} 条 · AI缓存已清除</span>
            </div>
            {uploadResult.cleaning && (
              <div className="text-[12px] text-black/40 pl-6">🧹 {uploadResult.cleaning.message}</div>
            )}
            {/* 城市级别状态 */}
            {uploadResult.hasCityTier === false ? (
              <div className="pl-6 space-y-1.5">
                <div className="text-[12px] text-[#FF9500] flex items-center gap-1">
                  <AlertCircle size={11} />城市级别列未就绪，需先在 Supabase SQL Editor 执行 <code className="bg-black/06 px-1 rounded">supabase/add_city_tier.sql</code>
                </div>
                <button onClick={async () => {
                  setBackfilling(true); setBackfillMsg('');
                  const res = await fetch('/api/admin/backfill-city-tier', { method: 'POST' });
                  const json = await res.json();
                  setBackfillMsg(res.ok ? `✓ ${json.message}` : `✗ ${json.error}`);
                  setBackfilling(false);
                }} disabled={backfilling}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-ios bg-[#FF9500]/10 text-[#FF9500] hover:bg-[#FF9500]/18 transition-colors disabled:opacity-50 no-tap">
                  {backfilling ? <Loader2 size={10} className="animate-spin" /> : null}
                  {backfilling ? '补充中…' : '补充城市级别（执行 SQL 后点击）'}
                </button>
                {backfillMsg && <div className="text-[11px] text-black/50">{backfillMsg}</div>}
              </div>
            ) : uploadResult.hasCityTier === true ? (
              <div className="text-[12px] text-[#34C759] pl-6">🏙 城市级别已自动计算并写入</div>
            ) : null}
          </div>
        )}
        {status === 'error' && (
          <div className="mt-3 glass-card-subtle p-3 flex items-center gap-2 border border-[#FF3B30]/20">
            <AlertCircle size={16} className="text-[#FF3B30] flex-shrink-0" />
            <span className="text-[13px] text-black/65">{errMsg}</span>
          </div>
        )}
      </div>

      <div className="mb-3"><DimensionsConfigPanel /></div>
      {/* AI Prompt 管理 */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Sparkles size={14} className="text-[#AF52DE]" />
          <h2 className="text-[15px] font-600 text-black/70">AI 洞察 Prompt 管理</h2>
        </div>
        <div className="mb-3"><OverviewInsightPanel /></div>
        <div className="space-y-3">
          <InsightsFieldPanel onSaved={loadPrompts} />
          {prompts.filter(p => p.prompt_key !== 'insights_fields').map(p => (
            <PromptCard key={p.id} prompt={p} onSaved={loadPrompts} />
          ))}
          {prompts.length === 0 && (
            <div className="glass-card p-6 text-center">
              <div className="text-[13px] text-black/35 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />Prompt 配置加载中…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 城市级别回填工具 */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-500 text-black/70">补充城市级别</div>
            <div className="text-[11px] text-black/35 mt-0.5">
              为当前版本中 city_tier 为空的记录自动计算城市级别。需先在 Supabase SQL Editor 执行 add_city_tier.sql。
            </div>
          </div>
          <button onClick={async () => {
            setBackfilling(true); setBackfillMsg('');
            const res = await fetch('/api/admin/backfill-city-tier', { method: 'POST' });
            const json = await res.json();
            setBackfillMsg(res.ok ? `✓ ${json.message}` : `✗ ${json.error}`);
            setBackfilling(false);
          }} disabled={backfilling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-ios text-[12px] bg-[#5856D6]/10 text-[#5856D6] hover:bg-[#5856D6]/18 transition-colors disabled:opacity-50 no-tap flex-shrink-0">
            {backfilling ? <Loader2 size={11} className="animate-spin" /> : null}
            {backfilling ? '处理中…' : '立即补充'}
          </button>
        </div>
        {backfillMsg && (
          <div className={cn('mt-2 text-[12px]', backfillMsg.startsWith('✓') ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
            {backfillMsg}
          </div>
        )}
      </div>

      {/* 版本历史 */}
      {versions.length > 0 && (
        <VersionHistory versions={versions} onDeleted={loadVersions} />
      )}
    </div>
  );
}
