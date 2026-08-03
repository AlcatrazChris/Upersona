import { NextRequest, NextResponse } from 'next/server';
import type { AIContext } from '@/lib/aiContext';

export const runtime = 'nodejs';

const AI_API_KEY  = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-chat';

interface ChatMessage {
  role:    'user' | 'assistant';
  content: string;
}

interface ReqBody {
  context:   AIContext;
  messages?: ChatMessage[];
  question?: string;   // legacy single-turn callers
  maxTokens?: number;
}

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json(
      { error: '未配置 AI_API_KEY，请在 .env.local 中设置' },
      { status: 503 }
    );
  }

  try {
    const body: ReqBody = await req.json();
    const { context, messages: rawMessages, question, maxTokens } = body;

    // Accept both multi-turn messages[] and legacy single question string
    const chatMessages: ChatMessage[] =
      rawMessages?.length ? rawMessages
      : question?.trim()  ? [{ role: 'user', content: question }]
      : [];

    if (!chatMessages.length) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    const systemPrompt = `你是一名专业的数据分析师，擅长从表格数据中发现规律和洞察。
用户提供的数据集统计摘要如下（JSON 格式）：

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

输出规则（严格遵守）：
- 只输出用户要求的格式和内容，不输出其他任何内容
- 禁止使用开场白、过渡段落、总结段落（如"综合来看""总体而言""以上分析""希望以上内容"等）
- 禁止使用"值得注意""不难发现""可以看出"等废话表达
- 每条结论直接陈述，不加铺垫
- 只引用上方真实统计数据，不编造数据集中没有的信息
- 使用中文，支持 Markdown 标题和粗体`;

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
          ...chatMessages,
        ],
        max_tokens:  Math.min(3000, Math.max(500, Number(maxTokens) || 1000)),
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
