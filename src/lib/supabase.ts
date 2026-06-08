/**
 * Supabase 客户端工厂
 *
 * getSupabaseAdmin() 使用 service_role key（绕过 RLS），
 * 仅在服务端（API Route / Server Action）调用，绝不暴露给客户端。
 */

import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('缺少 Supabase 环境变量：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
