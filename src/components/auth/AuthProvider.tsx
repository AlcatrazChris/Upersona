'use client';

import { AuthContext, type AuthUser } from '@/lib/auth';

interface Props {
  initialUser: AuthUser | null;
  children:    React.ReactNode;
}

/**
 * 将服务端读取的 session 用户注入 AuthContext。
 * 无需客户端 fetch：layout.tsx 在服务端已从 cookie 解析用户。
 */
export function AuthProvider({ initialUser, children }: Props) {
  return (
    <AuthContext.Provider value={{ user: initialUser, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
