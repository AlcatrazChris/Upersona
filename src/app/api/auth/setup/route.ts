/**
 * POST /api/auth/setup
 *
 * 首次部署时创建初始管理员账号。
 * 安全限制：
 *   - 仅当 upersona_users 表为空时可调用
 *   - 需要请求体携带 setupSecret（与环境变量 SETUP_SECRET 匹配）
 *   - 建议完成后在 Vercel 删除或清空 SETUP_SECRET
 */

import { NextResponse } from 'next/server';
import { hashPassword, isValidUsername, isValidPassword } from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const setupSecret = process.env.SETUP_SECRET;

  if (!setupSecret) {
    return NextResponse.json({ error: '未配置 SETUP_SECRET，无法初始化' }, { status: 403 });
  }

  let body: { setupSecret?: unknown; username?: unknown; password?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  if (body.setupSecret !== setupSecret) {
    return NextResponse.json({ error: 'setupSecret 不匹配' }, { status: 403 });
  }

  const username = typeof body.username === 'string' ? body.username.toLowerCase().trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidUsername(username)) {
    return NextResponse.json({ error: '用户名格式错误（3-30 位字母/数字/下划线）' }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 确保表为空（仅初始化一次）
  const { count } = await supabase
    .from('upersona_users')
    .select('*', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: '已有用户存在，禁止重复初始化' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('upersona_users')
    .insert({ username, password_hash: passwordHash, role: 'admin' })
    .select('id, username, role')
    .single();

  if (error) {
    return NextResponse.json({ error: `创建失败：${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: data });
}
