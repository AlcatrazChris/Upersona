import { NextRequest, NextResponse } from 'next/server';
import type { AIContext } from '@/lib/aiContext';

export const runtime = 'nodejs';

// 兼容新旧两种变量名
const AI_API_KEY  = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-chat';

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json(
      { error: '未配置 AI_API_KEY，请在 .env.local 中设置' },
      { status: 503 }
    );
  }

  try {
    const body: { context: AIContext; question: string } = await req.json();
    const { context, question } = body;

    if (!question?.trim()) {
      return NextResponse.json({ error: '问题不能为空' }, { status: 400 });
    }

    const systemPrompt = `你是一名专业的数据分析师，擅长从表格数据中发现规律和洞察。
用户会提供一份数据集的统计摘要（JSON 格式），请基于这些真实统计数据作答。
不要编造数据集中没有的信息。回答要简洁、专业、使用中文。`;

    const userMessage = `数据集统计摘要：
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

用户问题：${question}`;

    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model:    AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API 错误 ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content ?? '（AI 无回复）';

    return NextResponse.json({ answer });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI 请求失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
