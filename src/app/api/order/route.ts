import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const AI_API_KEY  = process.env.AI_API_KEY  ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-chat';

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

如果有天然排序，请按照"从大到小/从高到低/从强到弱"的顺序返回所有选项（即最大值排第一，最小值排最后）。
选项值必须与输入完全一致，不得修改任何字符。
如果没有天然排序，返回 isOrdered: false，orderedValues 为空数组。

请严格以JSON格式返回，不输出任何其他内容：
{"isOrdered": true/false, "orderedValues": ["最大值", ..., "最小值"]}`;

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
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
    const result = JSON.parse(raw) as { isOrdered: boolean; orderedValues: string[] };

    // Validate: every returned value must appear in the input set
    const inputSet = new Set(vals);
    if (result.isOrdered && Array.isArray(result.orderedValues)) {
      result.orderedValues = result.orderedValues.filter(v => inputSet.has(v));
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI排序失败' },
      { status: 500 },
    );
  }
}
