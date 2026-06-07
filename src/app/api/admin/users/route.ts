/**
 * /api/admin/users
 *
 * GET  — 列出所有用户（仅管理员可调用）
 * PATCH — 修改指定用户角色（仅管理员可调用）
 *
 * 角色存储在 Clerk publicMetadata.role，值为 'admin' 或 'viewer'。
 * 未设置时默认视为 'viewer'。
 */

import { NextResponse } from 'next/server';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// ── 公共：鉴权 + 校验调用者是否为管理员 ─────────────────────────
async function requireAdmin() {
  if (!CLERK_ENABLED) {
    return { error: NextResponse.json({ error: '认证系统未配置' }, { status: 503 }) };
  }

  const { auth, clerkClient } = await import('@clerk/nextjs/server');
  const { userId } = await auth();

  if (!userId) {
    return { error: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  }

  const client = await clerkClient();
  const caller = await client.users.getUser(userId);

  if ((caller.publicMetadata?.role as string) !== 'admin') {
    return { error: NextResponse.json({ error: '无权限，仅管理员可操作' }, { status: 403 }) };
  }

  return { userId, client };
}

// ── GET /api/admin/users ──────────────────────────────────────
export async function GET() {
  const result = await requireAdmin();
  if ('error' in result) return result.error;

  const { client } = result;
  const { data } = await client.users.getUserList({ limit: 200, orderBy: '-created_at' });

  return NextResponse.json(
    data.map(u => ({
      id:        u.id,
      name:      u.firstName
        ? `${u.firstName} ${u.lastName ?? ''}`.trim()
        : (u.emailAddresses[0]?.emailAddress?.split('@')[0] ?? '用户'),
      email:     u.emailAddresses[0]?.emailAddress ?? '',
      role:      (u.publicMetadata?.role as string) ?? 'viewer',
      createdAt: u.createdAt,
    })),
  );
}

// ── PATCH /api/admin/users ────────────────────────────────────
export async function PATCH(req: Request) {
  const result = await requireAdmin();
  if ('error' in result) return result.error;

  const body = await req.json() as { targetUserId?: string; role?: string };
  const { targetUserId, role } = body;

  if (!targetUserId || !['admin', 'viewer'].includes(role ?? '')) {
    return NextResponse.json({ error: '参数错误：需要 targetUserId 和合法的 role' }, { status: 400 });
  }

  // 防止管理员把自己降权（可选安全保护）
  if (targetUserId === result.userId) {
    return NextResponse.json({ error: '不能修改自己的角色' }, { status: 400 });
  }

  const { client } = result;
  await client.users.updateUserMetadata(targetUserId, {
    publicMetadata: { role },
  });

  return NextResponse.json({ ok: true, targetUserId, role });
}
