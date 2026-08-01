import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, verifyToken } from '@/lib/auth-server';
import { ORDERING_RULES, resolveAIOrder } from '@/lib/aiOrder';

export const runtime = 'nodejs';

const AI_API_KEY = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL = process.env.AI_MODEL ?? 'deepseek-v4-flash';

type FieldSummary = {
  key: string;
  name: string;
  type: string;
  unique: number;
  missingRate: number;
  values: string[];
};

type AnalyzeBody = {
  mode: 'ordering' | 'persona';
  fields: FieldSummary[];
};

async function requireAdmin() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return false;
  const user = await verifyToken(token);
  return user?.role === 'admin';
}

function sanitizeFields(input: unknown): FieldSummary[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 80).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Partial<FieldSummary>;
    const key = String(raw.key ?? '').trim().slice(0, 160);
    const name = String(raw.name ?? '').trim().slice(0, 160);
    if (!key || !name) return [];
    return [{
      key,
      name,
      type: String(raw.type ?? '').slice(0, 40),
      unique: Number.isFinite(raw.unique) ? Math.max(0, Number(raw.unique)) : 0,
      missingRate: Number.isFinite(raw.missingRate)
        ? Math.min(100, Math.max(0, Number(raw.missingRate)))
        : 0,
      values: Array.isArray(raw.values)
        ? [...new Set(raw.values.map(value => String(value).trim()).filter(Boolean))].slice(0, 60)
        : [],
    }];
  });
}

function parseModelJSON(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function callAI(prompt: string): Promise<unknown> {
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AI API ${response.status}: ${message.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.choices?.[0]?.finish_reason === 'length') {
    throw new Error('AI 返回内容被截断，请重试');
  }
  return parseModelJSON(data.choices?.[0]?.message?.content ?? '{}');
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '仅管理员可执行 AI 字段分析' }, { status: 403 });
  }
  if (!AI_API_KEY) {
    return NextResponse.json({ error: '未配置 AI_API_KEY' }, { status: 503 });
  }

  let body: AnalyzeBody;
  try {
    body = await request.json() as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const fields = sanitizeFields(body.fields);
  if (!['ordering', 'persona'].includes(body.mode) || fields.length === 0) {
    return NextResponse.json({ error: '没有可分析的字段' }, { status: 400 });
  }

  try {
    if (body.mode === 'ordering') {
      const batches = Array.from(
        { length: Math.ceil(fields.length / 12) },
        (_, index) => fields.slice(index * 12, index * 12 + 12),
      );
      const batchResults = await Promise.all(batches.map(async batch => {
        const prompt = `你是数据分析专家。判断每个调查字段是否具有客观、稳定的天然顺序。

规则：
1. 年龄段、收入、学历、满意度、频率、金额、数量、时长、等级等可以排序。
2. 地区、品牌、职业、性别、渠道、颜色、车型等平行类别不能排序。
3. 有顺序时必须按从大到小、从高到低、从强到弱排列；orderedIndices 的第0项必须对应最大、最高或最强的值，它会显示在图表最上方。
4. fieldIndex 和 orderedIndices 都从0开始。orderedIndices 必须完整包含对应 values 的全部序号，不得遗漏或重复。
5. 不要返回字段名、字段 key 或选项文本。

字段：
${JSON.stringify(batch.map((field, fieldIndex) => ({
  fieldIndex,
  name: field.name,
  type: field.type,
  values: field.values,
})))}

只返回 JSON：
{"orderings":[{"fieldIndex":0,"isOrdered":true,"orderedIndices":[2,1,0]}]}`;

        const raw = await callAI(`${ORDERING_RULES}\n${prompt}`) as {
          orderings?: Array<{
            fieldIndex?: unknown;
            isOrdered?: unknown;
            orderedIndices?: unknown;
          }>;
        };
        return (Array.isArray(raw.orderings) ? raw.orderings : []).flatMap(item => {
          const fieldIndex = Number(item.fieldIndex);
          const field = batch[fieldIndex];
          if (!field || item.isOrdered !== true || !Array.isArray(item.orderedIndices)) return [];
          const indices = item.orderedIndices.map(Number);
          if (
            indices.length !== field.values.length ||
            new Set(indices).size !== field.values.length ||
            indices.some(index => !Number.isInteger(index) || index < 0 || index >= field.values.length)
          ) return [];
          const result = resolveAIOrder(JSON.stringify(item), field.values);
          return [{ key: field.key, isOrdered: true, orderedValues: result.orderedValues }];
        });
      }));
      const orderings = batchResults.flat();
      return NextResponse.json({ orderings });
    }

    const prompt = `你是汽车用户研究的数据架构专家。请从候选字段中识别适合用于用户画像和人群对比的字段。

优先选择：
- 人口属性：年龄、性别、学历、职业、收入、家庭结构
- 车辆属性：当前车型、购车类型、增换购、用车经历
- 需求偏好：购车动机、功能偏好、决策因素、信息渠道
- 生活方式与使用场景

必须排除：
- 姓名、手机号、证件号、用户ID、订单号等个人标识
- 提交时间、创建时间等时间字段
- 订单状态、意向状态、流程阶段
- 大区、省份、城市等专用地区字段
- 自由文本、备注、开放题、高唯一值技术字段

字段摘要：
${JSON.stringify(fields)}

同时为每个字段判断语义角色，只能使用：
demographic, geography, lifecycle, behavior, motivation, preference, barrier, intent, open_text, metadata。
为进入画像的字段推荐图表，只能使用：
bar, lollipop, waffle, donut, line, area, ranking-heatmap, scatter, histogram, dumbbell, difference, heatmap。
多字段图表只有在数据中存在合适关联字段时才推荐。
只返回 JSON，personaFieldKeys 按分析价值从高到低排列，metadata 不得进入 personaFieldKeys，key 必须来自输入：
{"personaFieldKeys":["字段key"],"roles":{"字段key":"semanticRole"},"chartTypes":{"字段key":"chartType"},"reasons":{"字段key":"简短理由"}}`;

    const raw = await callAI(prompt) as {
      personaFieldKeys?: unknown;
      roles?: unknown;
      chartTypes?: unknown;
      reasons?: unknown;
    };
    const allowed = new Set(fields.map(field => field.key));
    const personaFieldKeys = Array.isArray(raw.personaFieldKeys)
      ? [...new Set(raw.personaFieldKeys.map(String).filter(key => allowed.has(key)))]
      : [];
    const rawReasons = raw.reasons && typeof raw.reasons === 'object'
      ? raw.reasons as Record<string, unknown>
      : {};
    const reasons = Object.fromEntries(
      personaFieldKeys.map(key => [key, String(rawReasons[key] ?? '').slice(0, 100)]),
    );
    const allowedRoles = new Set([
      'demographic', 'geography', 'lifecycle', 'behavior', 'motivation',
      'preference', 'barrier', 'intent', 'open_text', 'metadata',
    ]);
    const rawRoles = raw.roles && typeof raw.roles === 'object'
      ? raw.roles as Record<string, unknown>
      : {};
    const roles = Object.fromEntries(
      fields.map(field => {
        const role = String(rawRoles[field.key] ?? 'metadata');
        return [field.key, allowedRoles.has(role) ? role : 'metadata'];
      }),
    );
    const chartTypesByFieldType: Record<string, string[]> = {
      ranking: ['ranking-heatmap'],
      number: ['histogram', 'scatter', 'dumbbell', 'bar'],
      date: ['line', 'area'],
      single_choice: ['bar', 'lollipop', 'waffle', 'donut', 'difference', 'heatmap', 'dumbbell'],
      boolean: ['bar', 'lollipop', 'waffle', 'donut', 'difference', 'heatmap', 'dumbbell'],
      multi_choice: ['bar', 'lollipop', 'difference'],
      text: ['bar'],
    };
    const rawChartTypes = raw.chartTypes && typeof raw.chartTypes === 'object'
      ? raw.chartTypes as Record<string, unknown>
      : {};
    const chartTypes = Object.fromEntries(personaFieldKeys.map(key => {
      const field = fields.find(item => item.key === key);
      const allowedTypes = chartTypesByFieldType[field?.type ?? 'text'] ?? ['bar'];
      const type = String(rawChartTypes[key] ?? 'bar');
      return [key, allowedTypes.includes(type) ? type : allowedTypes[0]];
    }));
    return NextResponse.json({ personaFieldKeys, roles, chartTypes, reasons });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 字段分析失败' },
      { status: 500 },
    );
  }
}
