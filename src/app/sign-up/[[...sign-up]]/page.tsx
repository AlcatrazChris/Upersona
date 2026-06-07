import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex h-screen">

      {/* ── Left: brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 px-10 py-12"
        style={{ background: '#0f1923' }}
      >
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

        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-white leading-snug">
            创建账号
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#7a9ab8' }}>
            注册后默认为<strong className="text-white">只读用户</strong>，可查看所有数据视图。
            如需上传数据或配置画像，请联系管理员开通权限。
          </p>
          <div
            className="rounded-xl p-4 text-xs leading-relaxed space-y-1.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="font-medium" style={{ color: '#7a9ab8' }}>权限说明</p>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">●</span>
              <span style={{ color: '#7a9ab8' }}>
                <span className="text-white font-medium">管理员</span> — 上传数据、配置字段与画像
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">●</span>
              <span style={{ color: '#7a9ab8' }}>
                <span className="text-white font-medium">只读用户</span> — 查看图表、应用筛选、导出
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px]" style={{ color: '#3d5066' }}>
          © 2025 Upersona · 通用数据洞察工具
        </p>
      </div>

      {/* ── Right: Clerk sign-up form ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-md">
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

          <SignUp
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
