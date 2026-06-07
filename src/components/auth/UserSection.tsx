'use client';

/**
 * UserSection — 侧边栏底部用户信息区
 *
 * - Clerk 已配置：显示头像、姓名、角色标签、AccountButton 下拉菜单（管理账号 / 退出登录）
 * - 未配置 Clerk：显示「本地模式」提示（开发/自部署场景）
 */

import { useIsAdmin } from '@/lib/auth';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Separated so useUser() is only called inside ClerkProvider
function ClerkUserInfo() {
  // Dynamic import in component form — avoid top-level import so Clerk hooks
  // are never invoked when ClerkProvider is absent.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useUser, UserButton } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');
  const { user, isLoaded } = useUser();
  const isAdmin = useIsAdmin();

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

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <UserButton
        appearance={{
          elements: {
            avatarBox: 'w-8 h-8',
            userButtonTrigger: 'rounded-xl focus:shadow-none',
          },
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-white/90 truncate leading-tight">
          {user?.firstName ?? user?.emailAddresses[0]?.emailAddress?.split('@')[0] ?? '用户'}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium leading-none ${
              isAdmin
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-white/8 text-white/40'
            }`}
          >
            {isAdmin ? '管理员' : '只读'}
          </span>
        </div>
      </div>
    </div>
  );
}

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

export function UserSection() {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {CLERK_ENABLED ? <ClerkUserInfo /> : <LocalModeInfo />}
    </div>
  );
}
