import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * 通用洞察自定义内容管理 API
 *
 * 使用 insights_cache 表，key 前缀 `custom_override:` 与 AI 缓存分离
 * data_version = 0 → 自定义内容不随数据版本更新被清除
 */

function overrideKey(originalKey: string): string {
  return `custom_override:${originalKey}`;
}

interface OverrideData {
  customText: string;
  prefer: 'ai' | 'custom';
}

function parseOverride(content: string | null): OverrideData {
  if (!content) return { customText: '', prefer: 'ai' };
  try {
    return JSON.parse(content) as OverrideData;
  } catch {
    return { customText: '', prefer: 'ai' };
  }
}

// ── GET: 读取自定义内容和偏好 ──────────────────────────────
export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return NextResponse.json({ customText: '', prefer: 'ai' });

  const db = createServiceClient();
  const { data } = await db.from('insights_cache')
    .select('content')
    .eq('cache_key', overrideKey(key))
    .single();

  return NextResponse.json(parseOverride(data?.content ?? null));
}

// ── POST: 保存自定义内容或切换偏好（admin only）─────────────
export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const body = await req.json();
  const { cacheKey, action, customText, prefer } = body as {
    cacheKey?: string;
    action?: 'saveCustom' | 'savePrefer';
    customText?: string;
    prefer?: 'ai' | 'custom';
  };

  if (!cacheKey || !action) {
    return NextResponse.json({ error: '缺少 cacheKey 或 action' }, { status: 400 });
  }

  const db = createServiceClient();
  const oKey = overrideKey(cacheKey);

  // 先读取已有数据
  const { data: existing } = await db.from('insights_cache')
    .select('content').eq('cache_key', oKey).single();
  const current = parseOverride(existing?.content ?? null);

  if (action === 'saveCustom') {
    current.customText = customText ?? '';
    // 保存自定义时自动切换偏好为 custom（如果有内容）
    if (current.customText) current.prefer = 'custom';
  } else if (action === 'savePrefer') {
    if (prefer === 'custom' && !current.customText) {
      return NextResponse.json({ error: '没有自定义内容，无法切换' }, { status: 400 });
    }
    current.prefer = prefer ?? 'ai';
  }

  await db.from('insights_cache').upsert({
    cache_key:    oKey,
    insight_type: 'custom_override',
    content:      JSON.stringify(current),
    data_version: 0,            // 自定义内容不随数据版本变化
    generated_at: new Date().toISOString(),
  }, { onConflict: 'cache_key' });

  return NextResponse.json(current);
}
