'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Shield, Eye, Loader2, RefreshCw,
  UserPlus, Trash2, KeyRound, Users, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

// ── 类型 ─────────────────────────────────────────────────────

interface Account {
  id:         string;
  username:   string;
  email:      string | null;
  role:       'admin' | 'viewer';
  created_at: string;
  last_login: string | null;
}

// ── 子组件：创建账号表单 ──────────────────────────────────────

function CreateAccountForm({ onCreated, onCancel }: {
  onCreated: (a: Account) => void;
  onCancel:  () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<'viewer' | 'admin'>('viewer');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/accounts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password, role }),
      });
      const data = await res.json() as Account & { error?: string };
      if (!res.ok) throw new Error(data.error ?? '创建失败');
      onCreated(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={e => void handleSubmit(e)} className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] font-medium text-gray-500 mb-1 block">用户名</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="3-30 位字母/数字"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-blue-400"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-500 mb-1 block">初始密码</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="至少 8 位"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">角色</label>
        <div className="flex gap-2">
          {(['viewer', 'admin'] as const).map(r => (
            <button
              key={r} type="button"
              onClick={() => setRole(r)}
              className={cn(
                'flex-1 py-1.5 rounded-xl text-xs transition-all',
                role === r
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              )}
            >
              {r === 'admin' ? '管理员' : '只读'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-xl text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="flex-1 py-2 rounded-xl text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
        >
          {loading && <Loader2 size={11} className="animate-spin" />}
          创建账号
        </button>
      </div>
    </form>
  );
}

// ── 子组件：重置密码 ──────────────────────────────────────────

function ResetPasswordForm({ accountId, onDone }: { accountId: string; onDone: () => void }) {
  const [pwd,     setPwd]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: pwd }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '重置失败');
      setDone(true);
      setTimeout(onDone, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '重置失败');
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <p className="text-xs text-emerald-600 text-center py-1">✓ 密码已重置</p>
  );

  return (
    <form onSubmit={e => void handleSubmit(e)} className="flex gap-2 items-center">
      {error && <span className="text-[10px] text-red-500">{error}</span>}
      <input
        type="password"
        value={pwd}
        onChange={e => setPwd(e.target.value)}
        placeholder="新密码（≥8位）"
        autoFocus
        className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400"
      />
      <button
        type="submit"
        disabled={loading || pwd.length < 8}
        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? <Loader2 size={10} className="animate-spin" /> : '确认'}
      </button>
      <button type="button" onClick={onDone} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">取消</button>
    </form>
  );
}

// ── 主 Modal ──────────────────────────────────────────────────

export function AccountManageModal({ onClose }: { onClose: () => void }) {
  const { user: currentUser } = useAuth();

  const [accounts,    setAccounts]    = useState<Account[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [creating,    setCreating]    = useState(false);
  const [resetId,     setResetId]     = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/accounts');
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setAccounts(await res.json() as Account[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  async function toggleRole(acc: Account) {
    const newRole = acc.role === 'admin' ? 'viewer' : 'admin';
    setUpdatingId(acc.id);
    try {
      const res = await fetch(`/api/admin/accounts/${acc.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, role: newRole } : a));
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteAccount(acc: Account) {
    if (!window.confirm(`确认删除账号「${acc.username}」？此操作不可撤销。`)) return;
    setDeletingId(acc.id);
    try {
      const res = await fetch(`/api/admin/accounts/${acc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setAccounts(prev => prev.filter(a => a.id !== acc.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[88vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users size={14} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">账号管理</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {loading ? '加载中…' : `共 ${accounts.length} 个账号`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCreating(true); setResetId(null); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
            >
              <UserPlus size={12} />
              新建账号
            </button>
            <button onClick={() => void load()} disabled={loading} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-all">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex-shrink-0">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {/* Create form */}
        {creating && (
          <div className="px-6 py-4 bg-blue-50/40 border-b border-blue-100 flex-shrink-0">
            <p className="text-xs font-semibold text-blue-700 mb-3">新建账号</p>
            <CreateAccountForm
              onCreated={acc => { setAccounts(prev => [...prev, acc]); setCreating(false); }}
              onCancel={() => setCreating(false)}
            />
          </div>
        )}

        {/* Account list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2 text-blue-400" />
              <span className="text-sm">加载账号列表…</span>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {accounts.map(acc => (
                <li key={acc.id} className="px-6 py-3.5 space-y-2">
                  {/* 主行 */}
                  <div className="flex items-center gap-3">
                    {/* 头像 */}
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold',
                      acc.role === 'admin'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500',
                    )}>
                      {(acc.username[0] ?? '?').toUpperCase()}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">{acc.username}</span>
                        {acc.id === currentUser?.id && (
                          <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md">当前</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        最近登录：{formatDate(acc.last_login)}
                      </div>
                    </div>

                    {/* 角色切换 */}
                    <button
                      onClick={() => void toggleRole(acc)}
                      disabled={updatingId !== null || acc.id === currentUser?.id}
                      title={acc.id === currentUser?.id ? '不能修改自己的角色' : (acc.role === 'admin' ? '点击降为只读' : '点击升为管理员')}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0',
                        acc.role === 'admin'
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                        (updatingId !== null || acc.id === currentUser?.id) && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      {updatingId === acc.id
                        ? <Loader2 size={10} className="animate-spin" />
                        : acc.role === 'admin' ? <Shield size={10} /> : <Eye size={10} />}
                      {acc.role === 'admin' ? '管理员' : '只读'}
                    </button>

                    {/* 重置密码 */}
                    <button
                      onClick={() => setResetId(resetId === acc.id ? null : acc.id)}
                      title="重置密码"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex-shrink-0"
                    >
                      <KeyRound size={13} />
                    </button>

                    {/* 删除 */}
                    {acc.id !== currentUser?.id && (
                      <button
                        onClick={() => void deleteAccount(acc)}
                        disabled={deletingId === acc.id}
                        title="删除账号"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                      >
                        {deletingId === acc.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>

                  {/* 重置密码表单（展开） */}
                  {resetId === acc.id && (
                    <div className="ml-11">
                      <ResetPasswordForm
                        accountId={acc.id}
                        onDone={() => setResetId(null)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex-shrink-0">
          <p className="text-[11px] text-gray-400">
            <span className="text-blue-600 font-medium">管理员</span> 可上传数据、配置字段&ensp;·&ensp;
            <span className="font-medium text-gray-600">只读</span> 仅可查看图表和筛选
          </p>
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modal, document.body) : null;
}
