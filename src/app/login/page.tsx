'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '登录失败');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="glass-card p-8 shadow-ios-xl">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4"
            style={{ background: 'linear-gradient(135deg,#007AFF 0%,#5856D6 100%)' }}>
            华
          </div>
          <h1 className="text-[20px] font-700 tracking-tight text-black/85">华境S 用户画像平台</h1>
          <p className="text-[13px] text-black/40 mt-1">请登录以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-500 text-black/50 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="input-ios"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label className="block text-[12px] font-500 text-black/50 mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="input-ios pr-10"
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/55 transition-colors"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-[13px] text-[#FF3B30] bg-[#FF3B30]/08 px-3 py-2 rounded-ios">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-ios btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" />登录中…</>
              : <><LogIn size={15} />登 录</>}
          </button>
        </form>
      </div>
    </div>
  );
}
