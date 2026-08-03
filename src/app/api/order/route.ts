import { NextRequest, NextResponse } from 'next/server';
import { buildAIOrderPrompt, ORDERING_SYSTEM_PROMPT, resolveAIOrder } from '@/lib/aiOrder';

export const runtime = 'nodejs';

const AI_API_KEY = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL = process.env.AI_MODEL ?? 'deepseek-v4-flash';

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) return NextResponse.json({ error: '未配置 AI_API_KEY' }, { status: 503 });

  const body: { fieldName?: string; values?: unknown[] } = await req.json();
  if (!body.fieldName || !Array.isArray(body.values) || body.values.length < 2) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  const values = [...new Set(body.values.map(String).map(value => value.trim()).filter(Boolean))].slice(0, 60);

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: ORDERING_SYSTEM_PROMPT },
          { role: 'user', content: buildAIOrderPrompt(body.fieldName, values) },
        ],
        max_tokens: 500,
        temperature: 0,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) throw new Error(`AI API ${response.status}: ${(await response.text()).slice(0, 200)}`);

    const data = await response.json();
    if (data.choices?.[0]?.finish_reason === 'length') throw new Error('AI 返回内容被截断，请重试');
    const raw = String(data.choices?.[0]?.message?.content ?? '').trim();
    if (!raw) throw new Error('AI 返回空结果，请重试');
    return NextResponse.json(resolveAIOrder(raw, values));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'AI排序失败' }, { status: 500 });
  }
}
