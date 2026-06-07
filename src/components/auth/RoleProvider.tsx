'use client';

/**
 * RoleProvider — 从 Clerk 读取 publicMetadata.role 并注入 RoleContext
 *
 * 只在 ClerkProvider 树内部渲染（layout.tsx 中 Clerk 已配置时才使用）。
 * 未完成加载前返回 'viewer'（保守降级）。
 */

import { useUser } from '@clerk/nextjs';
import { RoleContext, type AppRole } from '@/lib/auth';

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  const role: AppRole = isLoaded
    ? ((user?.publicMetadata?.role as AppRole) ?? 'viewer')
    : 'viewer';

  return (
    <RoleContext.Provider value={role}>
      {children}
    </RoleContext.Provider>
  );
}
