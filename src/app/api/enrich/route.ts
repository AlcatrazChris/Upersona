import { NextRequest, NextResponse } from 'next/server';
import { OCCUPATION_CATEGORIES } from '@/lib/fieldEnricher';

export const runtime = 'nodejs';

const AI_API_KEY  = process.env.AI_API_KEY  ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-chat';

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json({ error: '未配置 AI_API_KEY' }, { status: 503 });
  }

  const body: { type: 'occupation'; values: string[] } = await req.json();
  if (body.type !== 'occupation' || !Array.isArray(body.values)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const uniqueVals = [...new Set(body.values.filter(Boolean))].slice(0, 200);
  if (uniqueVals.length === 0) {
    return NextResponse.json({ mapping: {} });
  }

  const categoriesText = OCCUPATION_CATEGORIES.join('、');
  const prompt = `你是一名专业的数据分类专家。请将下列职业名称（JSON数组）中的每一项，映射到以下标准职业类别中最匹配的一个。

标准类别（必须严格使用以下类别之一，不能创建新类别）：
${categoriesText}

分类原则：
- 个体户/合伙人：自营店主、小老板、自由职业者
- 单位负责人：企业高管、厂长、校长等管理层
- 医疗人员：医生、护士、药剂师等
- 教育工作者：教师、讲师、培训师等
- 工程技术人员：软件工程师、设计师、工程师、程序员等
- 法律人员：律师、法官、检察官等
- 财务审计人员：会计师、审计师、税务人员等
- 金融从业者：银行职员、基金经理、保险等
- 科研人员：研究员、实验室人员等
- 文化艺术人员：演员、歌手、作家、记者等
- 行政办事人员：文员、秘书、行政人员、公务员等
- 商业服务人员：销售、客服、导购等
- 生产运输人员：工人、司机、快递员等
- 农林牧渔人员：农民、渔民等
- 军警：军人、警察等
- 其他：无法归类者

待分类职业列表：
${JSON.stringify(uniqueVals)}

请严格以JSON对象格式返回，键为职业名称，值为标准类别，不要输出任何其他内容：`;

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
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI API ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const mapping = JSON.parse(raw) as Record<string, string>;
    return NextResponse.json({ mapping });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI映射失败' },
      { status: 500 },
    );
  }
}
