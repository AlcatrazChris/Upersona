'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart2, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SignInPage() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [username,   setUsername]   = useState('');
  const [password,   setPassword]   = useState('');
  const [showPwd,    setShowPwd]    = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError('请输入用户名后再登录。');
      inputRef.current?.focus();
      return;
    }
    if (!password) {
      setError('请输入密码后再登录。');
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: username.trim(), password, rememberMe }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? '登录失败，请重试');
        setLoading(false);
        inputRef.current?.focus();
        return;
      }

      // 登录成功 → 刷新页面让 layout.tsx 重新读取 cookie
      router.push('/');
      router.refresh();
    } catch {
      setError('网络错误，请检查连接后重试');
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="flex min-h-dvh">

      {/* ── 左侧品牌面板 ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 px-10 py-12"
        style={{ background: '#0f1923' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5" aria-hidden="true">
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

        {/* Hero */}
        <div className="space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center">
            <BarChart2 size={24} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-snug mb-3 text-balance">
              数据驱动的<br />用户洞察
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#7a9ab8' }}>
              上传任意表格数据，自动识别字段类型，即时生成用户画像、地域对比、状态分析图表。
            </p>
          </div>
          <div className="space-y-2">
            {['自动字段识别与类型推断', '多维度交互式图表', '用户画像看板', '跨数据集状态对比'].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-xs" style={{ color: '#7a9ab8' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px]" style={{ color: '#3d5066' }}>
          © {new Date().getFullYear()} Upersona · 通用数据洞察工具
        </p>
      </div>

      {/* ── 右侧登录表单 ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm">

          {/* 移动端 Logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-[18px] h-[18px]" aria-hidden="true">
                <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
                <rect x="14" y="3"  width="7" height="7" rx="1.5" />
                <rect x="3"  y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-800">Upersona</span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900 text-balance">欢迎回来</h1>
            <p className="text-sm text-gray-500 mt-1.5">请输入账号信息登录系统</p>
          </div>

          <form onSubmit={e => void handleSubmit(e)} className="space-y-4">

            {/* 错误提示 */}
            {error && (
              <div role="alert" aria-live="assertive" className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* 用户名 */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium text-gray-600">用户名</label>
              <input
                id="username"
                name="username"
                ref={inputRef}
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); if (error) setError(''); }}
                autoComplete="username"
                spellCheck={false}
                disabled={loading}
                placeholder="例如：admin…"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all bg-white',
                  'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
                  loading && 'opacity-50 cursor-not-allowed',
                )}
              />
            </div>

            {/* 密码 */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-gray-600">密码</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  ref={passwordRef}
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
                  autoComplete="current-password"
                  disabled={loading}
                  placeholder="请输入密码…"
                  className={cn(
                    'w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all bg-white',
                    'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
                    loading && 'opacity-50 cursor-not-allowed',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPwd ? '隐藏密码' : '显示密码'}
                  aria-pressed={showPwd}
                >
                  {showPwd ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* 记住我 */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="rememberMe"
                checked={rememberMe}
                onChange={event => setRememberMe(event.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-gray-300 accent-blue-600"
              />
              <span className="text-xs text-gray-500">30 天内免登录</span>
            </label>

            {/* 提交 */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-2.5 rounded-xl text-sm font-medium transition-all',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {loading ? '登录中…' : '登 录'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
