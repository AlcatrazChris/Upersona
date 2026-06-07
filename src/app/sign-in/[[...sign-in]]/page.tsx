import { redirect } from 'next/navigation';
import { SignIn } from '@clerk/nextjs';
import { BarChart2 } from 'lucide-react';

// 未配置 Clerk 时直接回首页（防止 SignIn 组件在无 ClerkProvider 树中崩溃）
const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function SignInPage() {
  if (!CLERK_ENABLED) redirect('/');
  return (
    <div className="flex h-screen">

      {/* ── Left: brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 px-10 py-12"
        style={{ background: '#0f1923' }}
      >
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
              <rect x="14" y="3"  width="7" height="7" rx="1.5" />
              <rect x="3"  y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div>
            <div className="text-base font-semibold text-white tracking-tight">Upersona</div>
            <div className="text-xs" style={{ color: '#4a6080' }}>通用数据洞察平台</div>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center">
            <BarChart2 size={24} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white leading-snug mb-3">
              数据驱动的<br />用户洞察
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#7a9ab8' }}>
              上传任意表格数据，自动识别字段类型，即时生成用户画像、地域对比、状态分析图表。
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-2">
            {[
              '自动字段识别与类型推断',
              '多维度交互式图表',
              '用户画像看板',
              '跨数据集状态对比',
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-xs" style={{ color: '#7a9ab8' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px]" style={{ color: '#3d5066' }}>
          © 2025 Upersona · 通用数据洞察工具
        </p>
      </div>

      {/* ── Right: Clerk sign-in form ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="w-[18px] h-[18px]">
                <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
                <rect x="14" y="3"  width="7" height="7" rx="1.5" />
                <rect x="3"  y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-800">Upersona</span>
          </div>

          <SignIn
            appearance={{
              elements: {
                rootBox:          'w-full',
                card:             'shadow-none bg-transparent p-0',
                headerTitle:      'text-xl font-bold text-gray-900',
                headerSubtitle:   'text-sm text-gray-500',
                formButtonPrimary:
                  'bg-blue-600 hover:bg-blue-700 text-sm font-medium rounded-xl py-2.5 transition-all',
                formFieldInput:
                  'rounded-xl border-gray-200 text-sm focus:ring-blue-500 focus:border-blue-500',
                formFieldLabel:   'text-xs font-medium text-gray-600',
                footerActionLink: 'text-blue-600 hover:text-blue-700 font-medium',
                card__main:       'gap-5',
                dividerText:      'text-gray-400 text-xs',
                socialButtonsIconButton:
                  'border-gray-200 rounded-xl hover:bg-gray-50 transition-all',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
