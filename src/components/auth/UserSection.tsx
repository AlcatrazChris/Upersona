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
        className="space-y-1 border-t border-black/[0.06] px-3 py-3"
      >
        {/* 用户行 */}
        <div className="flex items-center gap-2.5">
          {/* 头像 */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#86868B]">
            <span className="text-white text-xs font-semibold">{initial}</span>
          </div>

          {/* 名称 + 角色 */}
          <div className="flex-1 min-w-0">
            <div className="truncate text-xs font-medium leading-tight text-[#1D1D1F]">
              {user.username}
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium leading-none ${
                isAdmin
                  ? 'bg-[#007AFF]/[0.08] text-[#007AFF]'
                  : 'bg-black/[0.04] text-[#86868B]'
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
            className="flex-shrink-0 rounded-lg p-1.5 text-[#AEAEB2] transition-colors hover:bg-black/[0.04] hover:text-[#1D1D1F]"
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
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#86868B] transition-colors hover:bg-black/[0.04] hover:text-[#1D1D1F]"
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
