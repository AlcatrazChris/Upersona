import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const AI_API_KEY  = process.env.AI_API_KEY  ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-chat';

/**
 * POST /api/enrich-field
 *
 * Body: { fieldName: string; values: string[]; prompt: string }
 * Response: { mapping: Record<string, string> }
 *
 * Asks the AI to map each unique field value to a category according to
 * the user's free-form prompt instruction.
 */
export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json({ error: '未配置 AI_API_KEY' }, { status: 503 });
  }

  const body: { fieldName?: string; values?: string[]; prompt?: string } = await req.json();
  const { fieldName, values, prompt } = body;

  if (!Array.isArray(values) || !prompt) {
    return NextResponse.json({ error: '参数错误：需要 values 和 prompt' }, { status: 400 });
  }

  const uniqueVals = [...new Set(values.filter(v => v && v.trim()))].slice(0, 300);
  if (uniqueVals.length === 0) {
    return NextResponse.json({ mapping: {} });
  }

  const systemMsg = `你是专业的数据分类专家。根据用户指令，将字段数据值映射到对应类别。
严格以 JSON 对象格式返回，键为原始值，值为分类结果，确保所有原始值都出现在结果中，不要输出任何其他内容。`;

  const userMsg = `字段名：${fieldName ?? '未知'}
分类要求：${prompt}

待分类值（JSON 数组）：
${JSON.stringify(uniqueVals)}

请返回映射结果 JSON：`;

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user',   content: userMsg },
        ],
        max_tokens: 3000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI API ${res.status}: ${txt.slice(0, 300)}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const mapping = JSON.parse(raw) as Record<string, string>;

    // Validate: ensure returned keys are a subset of input values
    const inputSet = new Set(uniqueVals);
    const safeMapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(mapping)) {
      if (inputSet.has(k) && typeof v === 'string') safeMapping[k] = v;
    }
    // Fill any missing values with '其他'
    for (const v of uniqueVals) {
      if (!(v in safeMapping)) safeMapping[v] = '其他';
    }

    return NextResponse.json({ mapping: safeMapping });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI 映射失败' },
      { status: 500 },
    );
  }
}
