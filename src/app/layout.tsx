import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Upersona — 通用数据洞察工具',
  description: '上传任意表格，自动识别字段类型，生成交互式图表',
};

// Clerk 仅在配置了 publishable key 时启用
const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

async function AuthProviders({ children }: { children: React.ReactNode }) {
  if (!CLERK_ENABLED) {
    // 本地模式：无认证，所有功能可用（RoleContext 默认值 = 'admin'）
    return <>{children}</>;
  }

  // 动态导入避免在未配置 Clerk 时报错
  const { ClerkProvider } = await import('@clerk/nextjs');
  const { RoleProvider } = await import('@/components/auth/RoleProvider');

  return (
    <ClerkProvider>
      <RoleProvider>{children}</RoleProvider>
    </ClerkProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="h-screen overflow-hidden bg-gray-50 antialiased">
        <AuthProviders>{children}</AuthProviders>
      </body>
    </html>
  );
}
