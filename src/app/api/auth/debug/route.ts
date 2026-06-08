/**
 * GET /api/auth/debug
 * 临时诊断接口 — 确认环境变量是否正确配置
 * !! 调试完成后删除此文件 !!
 */
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const checks: Record<string, string> = {};

  // 1. 检查环境变量
  const jwtSecret = process.env.JWT_SECRET ?? '';
  checks['JWT_SECRET'] = !jwtSecret
    ? '❌ 未设置'
    : jwtSecret.length < 32
    ? `❌ 长度不足 32 位（当前 ${jwtSecret.length} 位）`
    : `✅ 已设置（${jwtSecret.length} 位）`;

  checks['NEXT_PUBLIC_SUPABASE_URL'] = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `✅ ${process.env.NEXT_PUBLIC_SUPABASE_URL}`
    : '❌ 未设置';

  checks['SUPABASE_SERVICE_ROLE_KEY'] = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? `✅ 已设置（${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 12)}...）`
    : '❌ 未设置';

  // 2. 测试 Supabase 连接 + 查用户表
  let dbCheck = '';
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('upersona_users')
      .select('*', { count: 'exact', head: true });
    if (error) {
      dbCheck = `❌ 查询失败: ${error.message}`;
    } else {
      dbCheck = `✅ 连接正常，用户数: ${count ?? 0}`;
    }
  } catch (e) {
    dbCheck = `❌ 连接异常: ${e instanceof Error ? e.message : String(e)}`;
  }
  checks['Supabase DB'] = dbCheck;

  // 3. 测试 JWT 签发
  let jwtCheck = '';
  try {
    const jose = await import('jose');
    const secret = new TextEncoder().encode(jwtSecret);
    await new jose.SignJWT({ test: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1m')
      .sign(secret);
    jwtCheck = '✅ JWT 签发正常';
  } catch (e) {
    jwtCheck = `❌ JWT 签发失败: ${e instanceof Error ? e.message : String(e)}`;
  }
  checks['JWT sign'] = jwtCheck;

  return NextResponse.json(checks, { status: 200 });
}
