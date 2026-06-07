import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

/**
 * Clerk 환경변수가 설정된 경우에만 Clerk 미들웨어를 초기화합니다.
 * 없으면 단순 pass-through로 동작합니다.
 *
 * 이유: clerkMiddleware()로 export default를 감싸면 요청마다 Clerk이
 * 비밀키를 확인하려 하고, 키가 없으면 MIDDLEWARE_INVOCATION_FAILED가
 * 발생합니다. 지연 초기화를 사용해 키가 있을 때만 Clerk을 로드합니다.
 */

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// 최초 요청 시 한 번만 초기화, 이후 캐시해서 재사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _handler: ((req: NextRequest, event: NextFetchEvent) => any) | null = null;

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  // Clerk 미설정 시 → 모든 요청 통과 (로컬/초기 배포 모드)
  if (!CLERK_ENABLED) return NextResponse.next();

  // Clerk 설정 시 → 최초 1회만 핸들러 생성 후 캐시
  if (!_handler) {
    const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
    const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _handler = clerkMiddleware(async (auth: any, r: NextRequest) => {
      if (!isPublicRoute(r)) await auth.protect();
    });
  }

  return _handler(req, event);
}

export const config = {
  matcher: [
    // Next.js 내부 파일·정적 에셋 제외
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jiff?|webp|png|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // API 라우트는 항상 미들웨어 통과
    '/(api|trpc)(.*)',
  ],
};
