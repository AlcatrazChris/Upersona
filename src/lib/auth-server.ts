/**
 * 服务器端认证辅助函数（仅在 API Route / Server Component 中使用）
 *
 * ⚠️  此文件使用 next/headers + crypto，不能被 Client Component 导入
 */
import { cookies } from 'next/headers';
import { randomBytes, scryptSync } from 'crypto';
import { verifyToken, SESSION_COOKIE } from '@/lib/session';
import type { Role } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase';

// ── 会话检查 ─────────────────────────────────────────────────

/** 检查当前请求是否为 admin 角色（供 API Route 使用） */
export function requireAdmin(): boolean {
  try {
    const token   = cookies().get(SESSION_COOKIE)?.value ?? '';
    const session = verifyToken(token);
    return session?.role === 'admin';
  } catch {
    return false;
  }
}

/** 检查是否已登录（任意角色） */
export function requireAuth(): boolean {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value ?? '';
    return verifyToken(token) !== null;
  } catch {
    return false;
  }
}

// ── 密码哈希（scrypt，Node.js 内置，无额外依赖）────────────────

/** 生成密码哈希和随机盐值 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/** 验证明文密码是否匹配存储的哈希 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const derived = scryptSync(password, salt, 64).toString('hex');
  return derived === storedHash;
}

// ── 用户认证 ─────────────────────────────────────────────────

/**
 * 验证用户名密码并返回角色。
 *
 * 优先级：
 *   1. 环境变量超级管理员（ADMIN_USERNAME / ADMIN_PASSWORD）—— 始终可用的后门
 *   2. 数据库 accounts 表中的账号
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ role: Role; username: string } | null> {
  // ── 1. 环境变量超级管理员 ──
  const envAdminUser = process.env.ADMIN_USERNAME || 'admin';
  const envAdminPass = process.env.ADMIN_PASSWORD || '';
  if (username === envAdminUser && envAdminPass && password === envAdminPass) {
    return { role: 'admin', username };
  }

  // ── 2. 环境变量客户端账号（向后兼容，可选）──
  const envClientUser = process.env.CLIENT_USERNAME;
  const envClientPass = process.env.CLIENT_PASSWORD;
  if (envClientUser && envClientPass && username === envClientUser && password === envClientPass) {
    return { role: 'client', username };
  }

  // ── 3. 数据库 accounts 表 ──
  try {
    const db = createServiceClient();
    const { data } = await db
      .from('accounts')
      .select('username, password_hash, salt, role')
      .eq('username', username)
      .single();

    if (!data) return null;
    if (!verifyPassword(password, data.password_hash, data.salt)) return null;
    return { role: data.role as Role, username: data.username };
  } catch {
    // accounts 表不存在或查询失败时静默降级
    return null;
  }
}
