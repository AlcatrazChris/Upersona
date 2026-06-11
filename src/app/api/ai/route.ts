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
    const { context, messages: rawMessages, question } = body;

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

请基于以上真实统计数据作答，不要编造数据集中没有的信息。
回答要简洁、专业、使用中文，支持 Markdown 格式输出（可使用标题、列表、粗体等）。`;

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
        max_tokens:  2000,
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
