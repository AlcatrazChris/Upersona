import { NextRequest, NextResponse } from 'next/server';
import { parseTokenUnsafe, SESSION_COOKIE } from '@/lib/session';

/**
 * Next.js Middleware（Edge Runtime）
 *
 * 保护策略：
 * - /login          公开
 * - /api/auth/*     公开
 * - /api/*          公开（数据读取接口）；写操作在 API Route 内验证
 * - /admin          需要 admin 角色
 * - 其他所有路由     需要已登录（任意角色）
 */

const PUBLIC_PATHS = ['/login', '/api/auth'];
const ADMIN_PATHS  = ['/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源 & Next.js 内部路由直接放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 公开路径
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 读取 session cookie
  const token   = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  const session = parseTokenUnsafe(token);

  // 未登录 → 跳转登录页
  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search   = '';
    return NextResponse.redirect(loginUrl);
  }

  // 访问 admin 区但角色不是 admin → 重定向首页
  if (ADMIN_PATHS.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search   = '';
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除：
     * - _next/static  (静态资源)
     * - _next/image   (图片优化)
     * - 带扩展名的文件 (如 favicon.ico)
     */
    '/((?!_next/static|_next/image|.*\\..*).*)',
  ],
};
