'use client';

/**
 * 角色系统
 *
 * - admin  管理员：上传数据、配置字段、配置画像、查看所有视图
 * - viewer 只读用户：查看所有视图及图表，无法编辑配置
 *
 * Clerk 未配置时（无 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY）：
 *   所有用户默认为 admin（本地/开发模式）。
 *
 * Clerk 配置后，在 Clerk Dashboard → Users → Edit → publicMetadata 中设置：
 *   { "role": "admin" }  ← 管理员
 *   { "role": "viewer" } ← 只读用户（新注册用户默认为 viewer）
 */

import { createContext, useContext } from 'react';

export type AppRole = 'admin' | 'viewer';

// Default value 'admin' ensures the app works without a Provider (local dev, no Clerk)
export const RoleContext = createContext<AppRole>('admin');

export function useRole(): AppRole {
  return useContext(RoleContext);
}

export function useIsAdmin(): boolean {
  return useRole() === 'admin';
}
