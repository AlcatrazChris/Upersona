/**
 * /api/admin/accounts/[id]
 *
 * PATCH  — 修改角色 / 重置密码
 * DELETE — 删除用户（不能删除自己）
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyToken, hashPassword, isValidPassword,
  COOKIE_NAME,
} from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/supabase';

async function requireAdmin() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  return user?.role === 'admin' ? user : null;
}

// ── PATCH /api/admin/accounts/[id] ───────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  const { id } = params;
  let body: { role?: unknown; password?: unknown };
  try { body = await req.json() as typeof body; } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  // 修改角色
  if (body.role !== undefined) {
    if (!['admin', 'viewer'].includes(body.role as string)) {
      return NextResponse.json({ error: 'role 只能是 admin 或 viewer' }, { status: 400 });
    }
    if (id === admin.id) {
      return NextResponse.json({ error: '不能修改自己的角色' }, { status: 400 });
    }
    updates.role = body.role;
  }

  // 重置密码
  if (body.password !== undefined) {
    if (!isValidPassword(body.password as string)) {
      return NextResponse.json({ error: '新密码至少 8 位' }, { status: 400 });
    }
    updates.password_hash = await hashPassword(body.password as string);
    // 重置密码同时清除锁定状态
    updates.failed_attempts = 0;
    updates.locked_until    = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('upersona_users')
    .update(updates)
    .eq('id', id)
    .select('id, username, role')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ── DELETE /api/admin/accounts/[id] ──────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  const { id } = params;

  if (id === admin.id) {
    return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from('upersona_users')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
