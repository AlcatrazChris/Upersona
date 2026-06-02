import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET: 获取最近登录日志（admin only）
// ?limit=50&username=xxx
export async function GET(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit    = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const username = searchParams.get('username') || '';

  const db = createServiceClient();
  let query = db
    .from('login_logs')
    .select('id, username, ip, user_agent, success, logged_at')
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (username) {
    query = query.eq('username', username);
  }

  const { data, error } = await query;
  if (error) {
    // login_logs 表不存在时，返回空数组（不阻断页面渲染）
    if (error.code === '42P01') return NextResponse.json([]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
