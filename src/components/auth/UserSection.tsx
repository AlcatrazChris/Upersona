'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, Loader2 } from 'lucide-react';
import { useAuth, useIsAdmin } from '@/lib/auth';
import { AccountManageModal } from './AccountManageModal';

export function UserSection() {
  const { user }  = useAuth();
  const isAdmin   = useIsAdmin();
  const router    = useRouter();

  const [showManage,  setShowManage]  = useState(false);
  const [loggingOut,  setLoggingOut]  = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/sign-in');
    router.refresh();
  }

  if (!user) return null;

  const initial = (user.username[0] ?? '?').toUpperCase();

  return (
    <>
      <div
        className="px-3 py-2.5 space-y-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* 用户行 */}
        <div className="flex items-center gap-2.5">
          {/* 头像 */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">{initial}</span>
          </div>

          {/* 名称 + 角色 */}
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-white/90 truncate leading-tight">
              {user.username}
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium leading-none ${
                isAdmin
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-white/[0.08] text-white/40'
              }`}
            >
              {isAdmin ? '管理员' : '只读'}
            </span>
          </div>

          {/* 退出 */}
          <button
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            title="退出登录"
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all flex-shrink-0"
          >
            {loggingOut
              ? <Loader2 size={13} className="animate-spin" />
              : <LogOut size={13} />}
          </button>
        </div>

        {/* 管理员：用户管理入口 */}
        {isAdmin && (
          <button
            onClick={() => setShowManage(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-all text-left"
          >
            <Users size={11} className="flex-shrink-0" />
            账号管理
          </button>
        )}
      </div>

      {showManage && <AccountManageModal onClose={() => setShowManage(false)} />}
    </>
  );
}
