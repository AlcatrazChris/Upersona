/**
 * scripts/env.mjs
 * 为 Node.js 脚本加载 .env.local 环境变量
 *
 * 使用前请确保 .env.local 已创建（参考 .env.example）
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function loadEnv() {
  const envPath = join(rootDir, '.env.local');
  if (!existsSync(envPath)) {
    throw new Error(
      `.env.local 文件不存在！请复制 .env.example 为 .env.local 并填写配置。\n路径: ${envPath}`
    );
  }

  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
}

loadEnv();

export const config = {
  supabaseUrl:        process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  deepseekApiKey:     process.env.DEEPSEEK_API_KEY,
  adminPassword:      process.env.ADMIN_PASSWORD,
};

// 验证必要配置
const required = ['supabaseUrl', 'supabaseServiceKey', 'deepseekApiKey'];
for (const key of required) {
  if (!config[key]) {
    throw new Error(`缺少必要配置: ${key}（请检查 .env.local）`);
  }
}
