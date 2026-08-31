'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SignInPage() {
  const router = useRouter();
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) {
      setError('请输入用户名');
      usernameRef.current?.focus();
      return;
    }
    if (!password) {
      setError('请输入密码');
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const result = await response.json() as { ok?: boolean };
      if (!response.ok || !result.ok) {
        setError('用户名或密码错误');
        setLoading(false);
        passwordRef.current?.focus();
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('网络连接异常，请稍后重试');
      setLoading(false);
    }
  }

  const inputClassName = cn(
    'h-14 w-full rounded-xl bg-[#F5F5F7] text-[15px] text-[#1D1D1F] outline-none transition-[background-color,box-shadow] duration-200',
    'placeholder:text-[#A1A1A6] focus:bg-white focus:shadow-[0_0_0_1px_#007AFF]',
    'disabled:cursor-not-allowed disabled:opacity-60',
  );

  return (
    <main
      id="main-content"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#F5F7FA] px-5 py-8 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','PingFang_SC','Microsoft_YaHei',sans-serif] sm:px-6"
    >
      <section className="relative w-full max-w-[460px] rounded-3xl bg-white/90 px-6 py-9 shadow-[0_20px_60px_rgba(29,29,31,0.06)] backdrop-blur-xl sm:px-10 sm:py-11">
        <header className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] bg-white shadow-[0_8px_24px_rgba(0,122,255,0.12)]">
            <Image src="/icon02.png" alt="Upersona" width={52} height={52} className="h-[52px] w-[52px] object-contain" priority />
          </div>
          <div className="mt-5 text-[30px] font-bold tracking-[-0.035em] text-[#1D1D1F]">Upersona</div>
        </header>

        <div className="mt-10">
          <h1 className="text-center text-[30px] font-semibold tracking-[-0.03em] text-[#1D1D1F]">欢迎回来</h1>
        </div>

        <form onSubmit={event => void handleSubmit(event)} className="mt-7 space-y-3.5">
          <label className="relative block">
            <span className="sr-only">用户名</span>
            <UserRound aria-hidden="true" size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]" />
            <input
              ref={usernameRef}
              name="username"
              type="text"
              value={username}
              onChange={event => { setUsername(event.target.value); setError(''); }}
              autoComplete="username"
              spellCheck={false}
              disabled={loading}
              placeholder="用户名"
              className={cn(inputClassName, 'pl-12 pr-4')}
            />
          </label>

          <div>
            <label className="relative block">
              <span className="sr-only">密码</span>
              <LockKeyhole aria-hidden="true" size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]" />
              <input
                ref={passwordRef}
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => { setPassword(event.target.value); setError(''); }}
                autoComplete="current-password"
                disabled={loading}
                placeholder="密码"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                className={cn(inputClassName, 'pl-12 pr-12')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                disabled={loading}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#A1A1A6] transition-colors duration-200 hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/30"
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </label>
            {error && <p id="login-error" role="alert" aria-live="assertive" className="mt-2 px-1 text-xs text-[#FF3B30]">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] text-[17px] font-semibold text-white transition-[transform,background-color,opacity] duration-200 hover:-translate-y-px hover:bg-[#0066D6] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {loading && <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
