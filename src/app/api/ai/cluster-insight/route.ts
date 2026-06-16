import { NextRequest, NextResponse } from 'next/server';
import type { ClusterInsightResult, ClusterSegment } from '@/lib/viewConfig';

export const runtime = 'nodejs';

const AI_API_KEY  = process.env.AI_API_KEY  ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-chat';

interface FieldDist {
  name:         string;
  distribution: { value: string; pct: number; count: number }[];
}

interface ReqBody {
  datasetName:      string;
  label:            string;
  totalCount:       number;
  clusterFields:    FieldDist[];
  supplementFields: FieldDist[];
}

function fmtDist(fields: FieldDist[]): string {
  return fields.map(f => {
    const rows = f.distribution
      .slice(0, 6)
      .map(d => `    ${d.value}: ${d.pct.toFixed(1)}%（${d.count}人）`)
      .join('\n');
    return `  【${f.name}】\n${rows}`;
  }).join('\n\n');
}

function extractJson(raw: string): string {
  // Strip markdown code fences
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  // Find first { ... } block
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1);
  return raw.trim();
}

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json({ error: '未配置 AI_API_KEY' }, { status: 503 });
  }

  try {
    const { datasetName, label, totalCount, clusterFields, supplementFields } = await req.json() as ReqBody;

    const clusterFieldNames  = clusterFields.map(f => f.name).join('、');
    const clusterSection     = fmtDist(clusterFields);
    const supplementSection  = supplementFields.length > 0 ? fmtDist(supplementFields) : '（无）';
    const dimTemplate        = clusterFields
      .map(f => `        "${f.name}": { "top_value": "最典型取值", "est_pct": 0 }`)
      .join(',\n');

    const prompt = `你是麦肯锡资深市场研究专家，专注汽车行业用户细分研究。

**数据背景**
- 数据集：${datasetName}
- 分析范围：${label}
- 有效样本：${totalCount.toLocaleString()} 份

**聚类核心维度**（${clusterFieldNames}）
${clusterSection}

**辅助参考维度**
${supplementSection}

**分析要求**
1. 基于核心维度（${clusterFieldNames}）的实际数据分布，识别2-4个具有鲜明差异特征的人群群体，年龄/学历/职业/收入/生活状态均需纳入考量
2. 群体划分须忠实于数据——有明显聚集特征才单独成群，不强行均分
3. 群体命名：精准反映群体本质的中文描述（如"稳健务实的中坚力量"、"年轻高收入奋斗者"），严禁"人群A/B"
4. dimensions 中列出3-4个**最能区分该群体**的字段（从核心聚类维度中选，收入差异显著时必须纳入），est_pct 为该群体内该值的预估占比
5. key_traits 4条，每条含具体数字，写成有判断力的描述（如"高学历为核心特征——本科及以上占约65%，高出整体均值20%"）
6. core_insight 2-3句麦肯锡风格，直接指向营销/产品决策，引用数据
7. subtitle 格式：年龄段·学历·职业特征·收入水平·生活状态（用·分隔，最多5个维度）

**输出格式**（严格JSON，不输出任何其他内容）
{
  "segments": [
    {
      "name": "群体描述名",
      "subtitle": "30-40岁·本科·中层管理·家庭稳定期",
      "key_traits": ["特征1（含数字）", "特征2（含数字）", "特征3（含数字）", "特征4（含数字）"],
      "core_insight": "核心洞察2-3句（含数据依据）",
      "purchase_motivation": "购车动机与决策偏好",
      "dimensions": {
${dimTemplate}
      }
    }
  ],
  "overview": "整体人群一句话画像（含样本量和最显著特征，引用数据）"
}`;

    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model:       AI_MODEL,
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  3000,
        temperature: 0.4,
      }),
    });

    if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`);

    const data  = await res.json();
    const raw   = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(extractJson(raw)) as {
      segments: ClusterSegment[];
      overview?: string;
    };

    const result: ClusterInsightResult = {
      segments:    parsed.segments ?? [],
      overview:    parsed.overview,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '聚类分析失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
