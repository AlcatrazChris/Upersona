/**
 * Middleware — JWT 会话校验（Edge Runtime 兼容）
 *
 * 安全逻辑：
 * 1. 公开路径（/sign-in、/api/auth/*）直接放行
 * 2. 其余路径必须携带合法 JWT Cookie
 * 3. Token 过期或伪造 → 清除 cookie + 重定向登录页
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

const COOKIE_NAME = 'upersona_session';

// 无需鉴权的路径前缀
const PUBLIC_PREFIXES = [
  '/sign-in',
  '/api/auth/',           // login / logout / me / setup
  '/_next/',
  '/favicon.ico',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function getJwtSecret(): Uint8Array {
  // JWT_SECRET 为空时（构建阶段）使用占位值，不影响实际请求
  return new TextEncoder().encode(process.env.JWT_SECRET ?? '__build_placeholder__');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  try {
    await jose.jwtVerify(token, getJwtSecret());
    return NextResponse.next();
  } catch {
    // Token 无效或过期：清除旧 cookie，重定向登录页
    const res = NextResponse.redirect(new URL('/sign-in', req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}

export const config = {
  matcher: [
    // 排除静态资源，但包含所有页面和 API 路由
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|css)).*)',
  ],
};
