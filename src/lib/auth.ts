'use client';

/**
 * 客户端 Auth Context
 *
 * AuthProvider（layout.tsx 中注入）从服务端 cookie 读取 initialUser，
 * 将其存入 Context。组件通过 useAuth() / useIsAdmin() 消费。
 */

import { createContext, useContext } from 'react';

export type AppRole = 'admin' | 'viewer';

export interface AuthUser {
  id:       string;
  username: string;
  role:     AppRole;
}

export interface AuthState {
  user:    AuthUser | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthState>({ user: null, loading: false });

export function useAuth():    AuthState { return useContext(AuthContext); }
export function useRole():    AppRole  { return useAuth().user?.role ?? 'viewer'; }
export function useIsAdmin(): boolean  { return useRole() === 'admin'; }
