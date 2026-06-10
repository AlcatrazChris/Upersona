/**
 * 服务端 Auth 工具
 *
 * 安全要点：
 * - bcrypt cost=12 → 哈希耗时 ~200-400ms，防暴力破解
 * - jose HS256 JWT → 无状态会话，Token 含角色信息
 * - httpOnly + secure + sameSite=strict cookie → 防 XSS / CSRF
 * - 同步时间常数比较（防 timing attack）
 * - 用户名统一小写 + 去空格处理
 *
 * 此文件只在 Node.js 运行时（API Route）使用，不可在 middleware / 客户端调用。
 * Middleware 中只用 jose 的 jwtVerify（Edge 兼容）。
 */

import * as jose from 'jose';
import bcrypt from 'bcryptjs';

// ── 常量 ─────────────────────────────────────────────────────

export const COOKIE_NAME   = 'upersona_session';
export const BCRYPT_ROUNDS = 12;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET 未设置或长度不足 32 字符');
  }
  return new TextEncoder().encode(secret);
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path:     '/',
};

// ── 类型 ─────────────────────────────────────────────────────

export interface SessionUser {
  id:       string;
  username: string;
  role:     'admin' | 'viewer';
}

// ── JWT ──────────────────────────────────────────────────────

/**
 * 签发 JWT
 * @param rememberMe true → 30 天；false → 8 小时
 */
export async function signToken(
  user: SessionUser,
  rememberMe = false,
): Promise<string> {
  return new jose.SignJWT({
    sub:      user.id,
    username: user.username,
    role:     user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '30d' : '8h')
    .sign(getJwtSecret());
}

/** 验证 JWT，失效或伪造返回 null */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret());
    const { sub, username, role } = payload as {
      sub: string; username: string; role: string;
    };
    if (!sub || !username || !['admin', 'viewer'].includes(role)) return null;
    return { id: sub, username, role: role as 'admin' | 'viewer' };
  } catch {
    return null;
  }
}

// ── 密码 ─────────────────────────────────────────────────────

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 伪 hash 比较（防 timing attack：当用户不存在时也消耗相同时间）
 * 固定使用一个永远不会匹配的 hash
 */
export async function dummyVerify(password: string): Promise<void> {
  await bcrypt.compare(password, '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
}

// ── 输入校验 ─────────────────────────────────────────────────

/** 用户名：3-30 字符，字母/数字/下划线/连字符（如 SGMW-SD → sgmw-sd） */
export function isValidUsername(v: string): boolean {
  return /^[a-zA-Z0-9_-]{3,30}$/.test(v);
}

/** 密码：8-100 字符 */
export function isValidPassword(v: string): boolean {
  return typeof v === 'string' && v.length >= 8 && v.length <= 100;
}
