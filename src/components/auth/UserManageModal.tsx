'use client';

/**
 * UserManageModal — 管理员专属用户角色管理面板
 *
 * 从 /api/admin/users 拉取用户列表，支持一键切换 admin/viewer 角色。
 * 需要在 ClerkProvider 树内使用（由 UserSection 条件渲染）。
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Eye, Loader2, RefreshCw, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserRecord {
  id:        string;
  name:      string;
  email:     string;
  role:      'admin' | 'viewer';
  createdAt: number;
}

export function UserManageModal({ onClose }: { onClose: () => void }) {
  const [users,    setUsers]    = useState<UserRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setUsers(await res.json() as UserRecord[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 关闭：点击遮罩或按 Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function toggleRole(user: UserRecord) {
    const newRole = user.role === 'admin' ? 'viewer' : 'admin';
    setUpdating(user.id);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ targetUserId: user.id, role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      setUpdating(null);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users size={14} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">用户权限管理</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {loading ? '加载中…' : `共 ${users.length} 名用户`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              title="刷新"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div className="mx-5 mt-3 px-3.5 py-2.5 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex-shrink-0">
            {error}
          </div>
        )}

        {/* User list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 size={22} className="animate-spin mb-2 text-blue-400" />
              <span className="text-sm">正在加载用户列表…</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              暂无注册用户
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 px-2 py-2">
              {users.map(user => (
                <li key={user.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold',
                    user.role === 'admin'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                      : 'bg-gradient-to-br from-gray-400 to-gray-500',
                  )}>
                    {(user.name[0] ?? '?').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{user.name}</div>
                    <div className="text-xs text-gray-400 truncate">{user.email}</div>
                  </div>

                  {/* Role toggle button */}
                  <button
                    onClick={() => void toggleRole(user)}
                    disabled={updating !== null}
                    title={user.role === 'admin' ? '点击降为只读' : '点击升为管理员'}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0',
                      user.role === 'admin'
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                      updating !== null && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    {updating === user.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : user.role === 'admin' ? (
                      <Shield size={11} />
                    ) : (
                      <Eye size={11} />
                    )}
                    {user.role === 'admin' ? '管理员' : '只读'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex-shrink-0">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            <span className="text-blue-600 font-medium">管理员</span> — 上传数据、配置字段与画像&nbsp;&nbsp;
            <span className="text-gray-600 font-medium">只读</span> — 查看图表、应用筛选
          </p>
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modal, document.body) : null;
}
