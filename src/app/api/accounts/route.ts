import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin, hashPassword } from '@/lib/auth-server';
import { verifyToken, SESSION_COOKIE } from '@/lib/session';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// ── GET: 列出所有账号（admin only）──────────────────────────
export async function GET() {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from('accounts')
    .select('id, username, role, created_at, updated_at')
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// ── POST: 创建新账号（admin only）───────────────────────────
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const body = await req.json();
  const { username, password, role } = body as {
    username?: string; password?: string; role?: string;
  };

  if (!username || !password) {
    return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
  }
  if (role !== 'admin' && role !== 'client') {
    return NextResponse.json({ error: '角色必须为 admin 或 client' }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: '密码至少 4 位' }, { status: 400 });
  }

  // 检查是否与环境变量超级管理员冲突
  const envAdmin = process.env.ADMIN_USERNAME || 'admin';
  const envClient = process.env.CLIENT_USERNAME;
  if (username === envAdmin || (envClient && username === envClient)) {
    return NextResponse.json({ error: '该用户名已被系统保留' }, { status: 409 });
  }

  const { hash, salt } = hashPassword(password);
  const db = createServiceClient();

  const { data, error } = await db.from('accounts').insert({
    username,
    password_hash: hash,
    salt,
    role,
  }).select('id, username, role, created_at').single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ── PUT: 修改密码或角色（admin only）────────────────────────
export async function PUT(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const body = await req.json();
  const { id, password, role } = body as {
    id?: number; password?: string; role?: string;
  };

  if (!id) {
    return NextResponse.json({ error: '缺少账号 ID' }, { status: 400 });
  }

  const db = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (password) {
    if (password.length < 4) {
      return NextResponse.json({ error: '密码至少 4 位' }, { status: 400 });
    }
    const { hash, salt } = hashPassword(password);
    updates.password_hash = hash;
    updates.salt = salt;
  }

  if (role) {
    if (role !== 'admin' && role !== 'client') {
      return NextResponse.json({ error: '角色必须为 admin 或 client' }, { status: 400 });
    }
    updates.role = role;
  }

  const { error } = await db.from('accounts').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// ── DELETE: 删除账号（admin only，不能删自己）───────────────
export async function DELETE(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const body = await req.json();
  const id = body.id as number;
  if (!id) {
    return NextResponse.json({ error: '缺少账号 ID' }, { status: 400 });
  }

  // 获取当前登录用户名，防止删除自己
  const token = cookies().get(SESSION_COOKIE)?.value ?? '';
  const session = verifyToken(token);

  const db = createServiceClient();

  // 查要删除的账号
  const { data: target } = await db.from('accounts')
    .select('username').eq('id', id).single();

  if (!target) {
    return NextResponse.json({ error: '账号不存在' }, { status: 404 });
  }

  if (session && target.username === session.username) {
    return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });
  }

  const { error } = await db.from('accounts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
