import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { verifyToken } from '@/lib/auth-server';
import { AuthProvider } from '@/components/auth/AuthProvider';

export const metadata: Metadata = {
  title:       'Upersona — 通用数据洞察工具',
  description: '上传任意表格，自动识别字段类型，生成交互式图表',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 在服务端验证 session cookie，将用户信息传入客户端 Context
  // （Next.js 14: cookies() 是同步 API）
  const cookieStore = cookies();
  const token  = cookieStore.get('upersona_session')?.value;
  const user   = token ? await verifyToken(token) : null;

  return (
    <html lang="zh-CN">
      <body className="h-screen overflow-hidden bg-gray-50 antialiased">
        <AuthProvider initialUser={user}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
