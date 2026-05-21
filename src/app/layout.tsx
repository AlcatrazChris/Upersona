import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export const metadata: Metadata = {
  title: {
    default: '华境S 用户画像平台',
    template: '%s · 华境S',
  },
  description: '华境S 车型用户画像分析与洞察平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#f0f4ff" />
      </head>
      <body>
        <div className="flex min-h-screen">
          {/* 侧边导航 */}
          <Sidebar />

          {/* 主内容区 */}
          <div className="flex-1 flex flex-col ml-64">
            <TopBar />
            <main className="flex-1 p-6 lg:p-8 animate-fade-in">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
