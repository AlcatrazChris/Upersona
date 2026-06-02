import { NextRequest, NextResponse } from 'next/server';
import { signToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';
import { authenticateUser } from '@/lib/auth-server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** 从请求头提取客户端 IP（兼容 Vercel / Nginx 等代理） */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** 异步记录登录日志（失败不影响登录流程） */
async function recordLogin(username: string, ip: string, userAgent: string, success: boolean) {
  try {
    const db = createServiceClient();
    await db.from('login_logs').insert({ username, ip, user_agent: userAgent, success });
  } catch {
    // 静默失败：login_logs 表不存在时不阻断登录
  }
}

export async function POST(req: NextRequest) {
  const ip        = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = body.username || '';
    password = body.password || '';
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
  }

  const result = await authenticateUser(username, password);
  if (!result) {
    // 记录失败日志（非阻塞）
    recordLogin(username, ip, userAgent, false);
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }

  // 签发 token — 捕获 SESSION_SECRET 未设置等配置错误
  let token: string;
  try {
    token = signToken({ role: result.role, username: result.username, iat: Date.now() });
  } catch (e) {
    console.error('[login] signToken 失败:', e);
    return NextResponse.json(
      { error: '服务器配置错误，请联系管理员（SESSION_SECRET 未设置）' },
      { status: 500 }
    );
  }

  // 记录成功登录（非阻塞）
  recordLogin(result.username, ip, userAgent, true);

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
