import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';
import { clearPromptCache } from '@/lib/deepseek';
import { ALL_SEED_PROMPTS } from '@/lib/prompt-defaults';

export const dynamic = 'force-dynamic';

// GET: 获取所有 prompt（无需认证），并自动补全数据库中缺失的默认行
export async function GET() {
  const db = createServiceClient();

  // 自动种子：只插入 DB 中尚不存在的 prompt（ON CONFLICT DO NOTHING）
  // 已被管理员修改的行不会被覆盖
  try {
    await db.from('ai_prompts').upsert(ALL_SEED_PROMPTS, {
      onConflict: 'prompt_key',
      ignoreDuplicates: true,   // → INSERT ... ON CONFLICT DO NOTHING
    });
  } catch {
    // 静默：表不存在时不阻断页面渲染
  }

  const { data, error } = await db
    .from('ai_prompts')
    .select('id, prompt_key, prompt_name, system_hint, user_prompt, updated_at')
    .order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// PUT: 更新 prompt（需要管理员权限）
export async function PUT(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
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

  // 立即清除内存中的 prompt 缓存，确保下次请求从 DB 重新读取
  clearPromptCache(prompt_key);

  // 清除对应的洞察缓存，确保下次生成时使用新 prompt
  const insightTypeMap: Record<string, string> = {
    compare_insight:  'compare',
    core_card:        'core_card_v3',
    status_insight:   'status_insight',
    overview_insight: 'status_insight',
    area_portrait:    'area_portrait',
  };
  const insightType = insightTypeMap[prompt_key];
  if (insightType) {
    await db.from('insights_cache').delete().eq('insight_type', insightType);
  }

  // predictions_cache 表：predict_intent 变更时清除
  if (prompt_key === 'predict_intent') {
    await db.from('predictions_cache').delete().gt('user_id', 0);
  }

  return NextResponse.json({
    success: true,
    message: `Prompt "${prompt_key}" 已更新，缓存已清除`,
    cleared_type: insightType ?? (prompt_key === 'predict_intent' ? 'predictions_cache' : null),
  });
}
