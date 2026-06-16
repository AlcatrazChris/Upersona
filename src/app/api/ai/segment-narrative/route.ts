import { NextRequest, NextResponse } from 'next/server';
import type { SegmentNarrative } from '@/types/personaSchema';

export const runtime = 'nodejs';

const AI_API_KEY  = process.env.AI_API_KEY  ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-chat';

interface StatField {
  field: string;
  distribution: { value: string; pct: number }[];
}

interface ReqBody {
  datasetName:  string;
  segmentName:  string;
  segmentCount: number;
  totalCount:   number;
  keywords:     string[];
  stats: {
    demoFields:  StatField[];
    chartFields: StatField[];
  };
}

function extractJson(text: string): string {
  // Strip markdown code fences if present
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Try to extract the first {...} block
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json({ error: '未配置 AI_API_KEY' }, { status: 503 });
  }

  let body: ReqBody;
  try { body = await req.json() as ReqBody; } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const { datasetName, segmentName, segmentCount, totalCount, keywords, stats } = body;

  const demoSummary = stats.demoFields.map(f =>
    `**${f.field}**: ${f.distribution.slice(0, 4).map(d => `${d.value}(${d.pct}%)`).join('、')}`
  ).join('\n');

  const chartSummary = stats.chartFields.map(f =>
    `**${f.field}**: ${f.distribution.slice(0, 4).map(d => `${d.value}(${d.pct}%)`).join('、')}`
  ).join('\n');

  const systemPrompt = `你是一名专业的用户研究与市场洞察分析师，擅长从数据中构建生动的用户画像叙事。
请严格按照要求输出 JSON，不要输出任何额外文字。`;

  const userPrompt = `数据集「${datasetName}」中，分群「${segmentName}」共 ${segmentCount} 人（占总量 ${totalCount} 人的 ${Math.round(segmentCount / totalCount * 100)}%）。

${keywords.length > 0 ? `画像词标签：${keywords.join('、')}\n` : ''}
**人口统计数据：**
${demoSummary || '（未配置）'}

**偏好数据：**
${chartSummary || '（未配置）'}

请基于以上真实数据，为此分群生成一份用户画像叙事，输出**纯 JSON**，格式严格如下：
{
  "psych_title": "（一句话消费心理定位，10-20字，如"理性进取的精英消费者"）",
  "psych_text": "（消费心理与动机的 Markdown 正文，2-4段，约150-250字，可用**加粗**重点）",
  "sections": [
    { "title": "价值取向", "content": "（60-80字简析）" },
    { "title": "信息获取", "content": "（60-80字简析）" },
    { "title": "决策风格", "content": "（60-80字简析）" },
    { "title": "品牌偏好", "content": "（60-80字简析）" }
  ],
  "purchase_text": "（购买偏好与决策路径的 Markdown 正文，2-3段，约100-150字）",
  "generatedAt": "${new Date().toISOString()}"
}

所有文字使用中文，严禁编造统计数据中没有的信息，仅基于已提供数据作分析推断。`;

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model:    AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens:  1500,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API 错误 ${res.status}: ${errText}`);
    }

    const data  = await res.json();
    const raw   = data.choices?.[0]?.message?.content ?? '';
    const clean = extractJson(raw);

    let narrative: SegmentNarrative;
    try {
      narrative = JSON.parse(clean) as SegmentNarrative;
    } catch {
      throw new Error(`AI 返回格式无法解析: ${raw.slice(0, 200)}`);
    }

    // Ensure generatedAt is set
    if (!narrative.generatedAt) narrative.generatedAt = new Date().toISOString();

    return NextResponse.json({ narrative });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI 请求失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
