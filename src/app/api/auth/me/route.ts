import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value ?? '';
  const session = verifyToken(token);
  if (!session) {
    return NextResponse.json({ role: null }, { status: 401 });
  }
  return NextResponse.json({ role: session.role, username: session.username });
}
