import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { clearPromptCache } from '@/lib/deepseek';

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password') || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  // 如果环境变量未设置，开发模式下放行（Vercel 必须设置）
  if (!expected) return process.env.NODE_ENV !== 'production';
  return provided === expected;
}

// GET: 获取所有 prompt（无需认证，前端展示用）
export async function GET() {
  const db = createServiceClient();
  const { data, error } = await db
    .from('ai_prompts')
    .select('id, prompt_key, prompt_name, system_hint, user_prompt, updated_at')
    .order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// PUT: 更新 prompt（需要认证）
export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: '认证失败：密码错误或未设置 ADMIN_PASSWORD 环境变量' }, { status: 401 });
  }

  const body = await req.json();
  const { prompt_key, user_prompt } = body;
  if (!prompt_key || !user_prompt) {
    return NextResponse.json({ error: '缺少参数 prompt_key 或 user_prompt' }, { status: 400 });
  }

  const db = createServiceClient();

  const { error } = await db
    .from('ai_prompts')
    .update({ user_prompt, updated_at: new Date().toISOString() })
    .eq('prompt_key', prompt_key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 立即清除内存中的 prompt 缓存，确保下次生成立刻用新 prompt
  clearPromptCache(prompt_key);

  // 清除相关洞察缓存，确保下次生成时用新 prompt 重新计算
  const insightTypeMap: Record<string, string> = {
    'compare_insight': 'compare',
    'core_card':       'core_card_v3',
    'insights_fields': 'core_card_v3',
    'status_insight':  'status_insight',
  };
  const insightType = insightTypeMap[prompt_key];
  if (insightType) {
    await db.from('insights_cache').delete().eq('insight_type', insightType);
  }

  return NextResponse.json({
    success: true,
    message: `Prompt "${prompt_key}" 已更新，相关洞察缓存已清除`,
    cleared_type: insightType ?? null,
  });
}
