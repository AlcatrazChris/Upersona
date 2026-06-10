/**
 * /api/admin/accounts
 *
 * GET  — 列出所有用户
 * POST — 创建新用户
 *
 * 所有操作均需 admin 角色
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyToken, hashPassword,
  isValidUsername, isValidPassword,
  COOKIE_NAME,
} from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ── 鉴权辅助 ─────────────────────────────────────────────────

async function requireAdmin() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  return user?.role === 'admin' ? user : null;
}

// ── GET /api/admin/accounts ───────────────────────────────────

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('upersona_users')
    .select('id, username, email, role, created_at, last_login')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ── POST /api/admin/accounts ──────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  let body: { username?: unknown; password?: unknown; role?: unknown; email?: unknown };
  try { body = await req.json() as typeof body; } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.toLowerCase().trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role     = body.role === 'admin' ? 'admin' : 'viewer';
  const email    = typeof body.email === 'string' ? body.email.trim() || null : null;

  if (!isValidUsername(username)) {
    return NextResponse.json({ error: '用户名格式错误（3-30 位字母/数字/下划线/连字符）' }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const { data, error } = await getSupabaseAdmin()
    .from('upersona_users')
    .insert({ username, password_hash: passwordHash, role, email })
    .select('id, username, email, role, created_at')
    .single();

  if (error) {
    const msg = error.code === '23505' ? '用户名已存在' : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  return NextResponse.json(data, { status: 201 });
}
