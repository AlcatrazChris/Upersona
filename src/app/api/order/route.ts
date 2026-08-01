import { NextRequest, NextResponse } from 'next/server';
import { ORDERING_RULES, resolveAIOrder } from '@/lib/aiOrder';

export const runtime = 'nodejs';

const AI_API_KEY  = process.env.AI_API_KEY  ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-v4-flash';

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json({ error: '未配置 AI_API_KEY' }, { status: 503 });
  }

  const body: { fieldName: string; values: string[] } = await req.json();
  if (!body.fieldName || !Array.isArray(body.values) || body.values.length < 2) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const vals = [...new Set(body.values.filter(Boolean))].slice(0, 60);

  const prompt = `你是一名数据分析专家。请判断以下调查问卷字段的选项是否存在天然的大小/高低排序规则。

字段名：${body.fieldName}
选项列表：${JSON.stringify(vals)}

判断原则：
- 有天然排序的字段：年龄段、收入范围、学历层次、消费金额、满意度评分、频率/频次、重要程度、使用年限、购买次数等有客观大小关系的字段
- 没有天然排序的字段：城市、品牌、职业类别、性别、颜色、渠道来源等平行并列的字段

如果有天然排序，请按照"从大到小/从高到低/从强到弱"的顺序返回所有选项的序号。返回数组的第0项必须对应最大、最高或最强的选项，它会显示在图表最上方。序号从0开始，不要重复，不要返回选项文本。
如果没有天然排序，返回 isOrdered: false，orderedIndices 为空数组。

请严格以JSON格式返回，不输出任何其他内容：
{"isOrdered": true/false, "orderedIndices": [2, 0, 1]}`;

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: `${ORDERING_RULES}\n${prompt}` }],
        max_tokens: 400,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI API ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content ?? '{}';
    const result = resolveAIOrder(raw, vals);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI排序失败' },
      { status: 500 },
    );
  }
}
