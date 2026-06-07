'use client';

/**
 * UserSection — 侧边栏底部用户信息区
 *
 * - Clerk 已配置：显示头像、姓名、角色标签、UserButton 下拉、管理员可打开用户管理面板
 * - 未配置 Clerk：显示「本地模式」提示（开发/自部署场景）
 */

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useIsAdmin } from '@/lib/auth';
import { UserManageModal } from './UserManageModal';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// ── Clerk 模式用户信息 ─────────────────────────────────────────

function ClerkUserInfo() {
  // 动态 require 防止在无 ClerkProvider 树中调用 Hook
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useUser, UserButton } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');
  const { user, isLoaded } = useUser();
  const isAdmin = useIsAdmin();
  const [showManage, setShowManage] = useState(false);

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-3 px-3 py-3 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 bg-white/10 rounded-full w-20" />
          <div className="h-2 bg-white/5 rounded-full w-14" />
        </div>
      </div>
    );
  }

  const displayName =
    user?.firstName ??
    user?.emailAddresses[0]?.emailAddress?.split('@')[0] ??
    '用户';

  return (
    <>
      <div className="px-3 py-2.5 space-y-2">
        {/* 用户行：头像 + 姓名 + 角色 */}
        <div className="flex items-center gap-2.5">
          <UserButton
            appearance={{
              elements: {
                avatarBox:          'w-8 h-8',
                userButtonTrigger:  'rounded-xl focus:shadow-none',
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-white/90 truncate leading-tight">
              {displayName}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
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
          </div>
        </div>

        {/* 管理员专属：用户管理入口 */}
        {isAdmin && (
          <button
            onClick={() => setShowManage(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-all text-left"
          >
            <Users size={11} className="flex-shrink-0" />
            管理用户权限
          </button>
        )}
      </div>

      {/* 用户管理 Modal */}
      {showManage && <UserManageModal onClose={() => setShowManage(false)} />}
    </>
  );
}

// ── 本地模式 ───────────────────────────────────────────────────

function LocalModeInfo() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <div className="w-8 h-8 rounded-xl bg-blue-600/30 flex items-center justify-center flex-shrink-0">
        <span className="text-blue-300 text-xs font-bold">A</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-white/70 leading-tight">本地模式</div>
        <div className="text-[10px] mt-0.5 text-white/30">未启用登录系统</div>
      </div>
    </div>
  );
}

// ── 导出 ───────────────────────────────────────────────────────

export function UserSection() {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {CLERK_ENABLED ? <ClerkUserInfo /> : <LocalModeInfo />}
    </div>
  );
}
