import { NextRequest, NextResponse } from 'next/server';
import { signToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';
import { authenticateUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({})) as Record<string, string>;

  if (!username || !password) {
    return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
  }

  const result = await authenticateUser(username, password);
  if (!result) {
    // 无论原因统一提示，防止用户名枚举
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }

  const token = signToken({ role: result.role, username: result.username, iat: Date.now() });

  const res = NextResponse.json({ ok: true, role: result.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  return res;
}
