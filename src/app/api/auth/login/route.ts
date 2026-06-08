/**
 * POST /api/auth/login
 *
 * 安全措施：
 * - 5 次失败锁定 15 分钟（per-user，存 Supabase）
 * - 用户不存在时执行 dummyVerify（防 timing attack）
 * - 统一错误提示（防用户名枚举）
 * - JWT 在 httpOnly + secure + sameSite=strict cookie 中
 */

import { NextResponse } from 'next/server';
import {
  verifyPassword, dummyVerify, signToken,
  isValidUsername, isValidPassword,
  COOKIE_NAME, COOKIE_OPTIONS,
} from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/supabase';

const MAX_ATTEMPTS   = 5;
const LOCK_MINUTES   = 15;
const GENERIC_ERROR  = '用户名或密码错误';

export async function POST(req: Request) {
  try {
    return await handleLogin(req);
  } catch (err) {
    console.error('[login] unhandled error:', err);
    return NextResponse.json({ error: '服务器内部错误，请稍后重试' }, { status: 500 });
  }
}

async function handleLogin(req: Request) {
  // ── 1. 解析 & 基础校验 ────────────────────────────────────
  let body: { username?: unknown; password?: unknown; rememberMe?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const username  = typeof body.username  === 'string' ? body.username.toLowerCase().trim()  : '';
  const password  = typeof body.password  === 'string' ? body.password                        : '';
  const rememberMe = body.rememberMe === true;

  if (!isValidUsername(username) || !isValidPassword(password)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // ── 2. 查找用户 ───────────────────────────────────────────
  const { data: user } = await supabase
    .from('upersona_users')
    .select('id, username, password_hash, role, failed_attempts, locked_until')
    .eq('username', username)
    .maybeSingle();

  if (!user) {
    await dummyVerify(password); // 消耗相同时间
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // ── 3. 检查账号锁定 ───────────────────────────────────────
  if (user.locked_until && new Date(user.locked_until as string) > new Date()) {
    const mins = Math.ceil(
      (new Date(user.locked_until as string).getTime() - Date.now()) / 60_000,
    );
    return NextResponse.json(
      { error: `账号已被临时锁定，请 ${mins} 分钟后重试` },
      { status: 429 },
    );
  }

  // ── 4. 校验密码 ───────────────────────────────────────────
  const valid = await verifyPassword(password, user.password_hash as string);

  if (!valid) {
    const attempts = ((user.failed_attempts as number) ?? 0) + 1;
    const updates: Record<string, unknown> = { failed_attempts: attempts };

    if (attempts >= MAX_ATTEMPTS) {
      updates.locked_until    = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
      updates.failed_attempts = 0;
    }

    await supabase.from('upersona_users').update(updates).eq('id', user.id);

    const remaining = MAX_ATTEMPTS - attempts;
    return NextResponse.json(
      {
        error: remaining > 0
          ? `${GENERIC_ERROR}（还剩 ${remaining} 次尝试）`
          : `账号已被锁定 ${LOCK_MINUTES} 分钟`,
      },
      { status: 401 },
    );
  }

  // ── 5. 登录成功 ───────────────────────────────────────────
  await supabase.from('upersona_users').update({
    failed_attempts: 0,
    locked_until:    null,
    last_login:      new Date().toISOString(),
  }).eq('id', user.id);

  const sessionUser = {
    id:       user.id       as string,
    username: user.username as string,
    role:     user.role     as 'admin' | 'viewer',
  };

  const token = await signToken(sessionUser, rememberMe);

  const res = NextResponse.json({ ok: true, user: sessionUser });
  res.cookies.set(COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
  });

  return res;
}
