/**
 * Session 管理：基于 HMAC-SHA256 签名的 HttpOnly Cookie
 * 不依赖任何额外 npm 包，使用 Node.js 内置 crypto 模块。
 *
 * Cookie 格式：<base64url-payload>.<base64url-signature>
 * Payload：{ role, username, iat }
 */

import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'huajing_session';
/** 7 天有效期（秒） */
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export type Role = 'client' | 'admin';

export interface SessionPayload {
  role: Role;
  username: string;
  /** issued-at Unix timestamp (ms) */
  iat: number;
}

// ── 内部工具 ──────────────────────────────────────────────────

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    // 开发环境允许空 secret，生产环境会被检测到
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET 环境变量未设置');
    }
    return 'dev-only-secret-DO-NOT-USE-IN-PROD';
  }
  return s;
}

function hmac(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

// ── 公开 API ──────────────────────────────────────────────────

/** 签发 token（API Route 中使用） */
export function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = hmac(data);
  return `${data}.${sig}`;
}

/** 验证并解析 token（API Route 中使用，Node.js runtime） */
export function verifyToken(token: string): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const data = token.slice(0, dot);
  const sig  = token.slice(dot + 1);

  // timing-safe 比对
  try {
    const expected = Buffer.from(hmac(data));
    const provided  = Buffer.from(sig);
    if (expected.length !== provided.length) return null;
    if (!timingSafeEqual(expected, provided)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionPayload;
    // 过期校验：SESSION_MAX_AGE
    if (Date.now() - payload.iat > SESSION_MAX_AGE * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * 轻量验证，仅检查 cookie 格式是否合规（用于 Edge Middleware）。
 * 不做 HMAC，只解析 payload 结构。Middleware 仅做路由保护，
 * 实际数据安全由 API Route 中的 verifyToken 保障。
 */
export function parseTokenUnsafe(token: string): Pick<SessionPayload, 'role'> | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.slice(0, dot), 'base64url').toString()
    ) as Partial<SessionPayload>;
    if (payload.role !== 'client' && payload.role !== 'admin') return null;
    return { role: payload.role };
  } catch {
    return null;
  }
}

// authenticate() 已迁移到 auth-server.ts → authenticateUser()
// auth-server.ts 支持环境变量 + 数据库 accounts 表双重认证
