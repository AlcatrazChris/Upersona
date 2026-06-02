import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: '华境S 用户画像平台',
    template: '%s · 华境S',
  },
  description: '华境S 车型用户画像分析与洞察平台',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#f0f4ff" />
      </head>
      <body>{children}</body>
    </html>
  );
}
