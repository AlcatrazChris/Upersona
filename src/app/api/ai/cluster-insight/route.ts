import { NextRequest, NextResponse } from 'next/server';
import type { ClusterInsightResult, ClusterSegment, DataPoint } from '@/lib/viewConfig';
import type { ClusterProfile } from '@/lib/clusterEngine';

export const runtime = 'nodejs';

const AI_API_KEY  = process.env.AI_API_KEY  ?? process.env.DEEPSEEK_API_KEY ?? '';
const AI_BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com/v1';
const AI_MODEL    = process.env.AI_MODEL    ?? 'deepseek-chat';

// ── Request types ──────────────────────────────────────────────

interface FieldDist {
  name:         string;
  distribution: { value: string; pct: number; count: number }[];
}

// V2: client-side statistical clustering already done
interface ReqBodyV2 {
  datasetName:  string;
  label:        string;
  totalCount:   number;
  optimalK:     number;
  clusters:     ClusterProfile[];
  fieldOptions: Record<string, string[]>; // fieldName → valid values
}

// V1: legacy distribution-based (fallback when clustering fails)
interface ReqBodyV1 {
  datasetName:      string;
  label:            string;
  totalCount:       number;
  clusterFields:    FieldDist[];
  supplementFields: FieldDist[];
}

function isV2(body: unknown): body is ReqBodyV2 {
  return typeof body === 'object' && body !== null &&
    'clusters' in body && Array.isArray((body as ReqBodyV2).clusters);
}

// ── V2 prompt: AI gets pre-computed cluster data ───────────────

/**
 * 格式化聚类数据，附带 delta（群体 pct − 全体 pct）。
 * 排序规则：delta 越高越靠前；过滤掉 delta ≤ -3pp 且不是 top-2 的条目，
 * 减少 AI 噪声，让 AI 只看到真正区分该群体的特征。
 */
function fmtClusters(clusters: ClusterProfile[]): string {
  return clusters.map((cl, i) => {
    const hdr = `群体${i + 1}（${cl.pct}%，n=${cl.size.toLocaleString()}）：`;

    const fmtField = (fd: ClusterProfile['clusterFieldDist'][0], maxItems = 5) => {
      const top2Keys = new Set(fd.topValues.slice(0, 2).map(v => v.value));
      const toShow = fd.topValues
        .filter(v => v.delta > -3 || top2Keys.has(v.value))
        .sort((a, b) => b.delta - a.delta)
        .slice(0, maxItems);
      if (!toShow.length) return null;
      const vals = toShow.map(v => {
        const sign = v.delta >= 0 ? '+' : '';
        const flag = v.delta >= 5 ? ' ▲' : '';
        return `${v.value} ${v.pct.toFixed(1)}%（全体${v.overallPct.toFixed(1)}%，${sign}${v.delta.toFixed(0)}pp${flag}）`;
      }).join('、');
      return `  【${fd.fieldName}】${vals}`;
    };

    const cLines = cl.clusterFieldDist
      .map(fd => fmtField(fd, 5))
      .filter(Boolean)
      .join('\n');

    const sLines = cl.supplementFieldDist.length > 0
      ? '\n  [参考维度]\n' + cl.supplementFieldDist
          .map(fd => {
            // 补充维度只展示 delta ≥ +3pp 的条目
            const toShow = fd.topValues
              .filter(v => v.delta >= 3)
              .sort((a, b) => b.delta - a.delta)
              .slice(0, 4);
            if (!toShow.length) return null;
            const vals = toShow.map(v => {
              const flag = v.delta >= 5 ? ' ▲' : '';
              return `${v.value} ${v.pct.toFixed(1)}%（+${v.delta.toFixed(0)}pp${flag}）`;
            }).join('、');
            return `  【${fd.fieldName}】${vals}`;
          })
          .filter(Boolean)
          .join('\n')
      : '';

    return `${hdr}\n${cLines}${sLines}`;
  }).join('\n\n');
}

function fmtFieldOptions(fieldOptions: Record<string, string[]>): string {
  return Object.entries(fieldOptions)
    .filter(([, opts]) => opts.length > 0)
    .map(([name, opts]) => `  ${name}：${opts.slice(0, 15).map(v => `"${v}"`).join('、')}`)
    .join('\n');
}

function buildPromptV2(body: ReqBodyV2): string {
  return `你是麦肯锡资深市场研究专家，专注汽车行业用户细分研究。

核心原则：**所有数据都是为结论服务的**——先形成洞察，再选择最能支撑结论的数据点展示，不要罗列数据。

**数据背景**
- 数据集：${body.datasetName}
- 分析范围：${body.label}
- 有效样本：${body.totalCount.toLocaleString()} 份

**统计聚类结果**（K-means + Calinski-Harabasz × 均衡惩罚，最优 k=${body.optimalK}）
以下占比和样本量均为服务端精确计算值，**不要在输出中包含或改写这些数字**。

数据格式说明：XX%（全体YY%，+Zpp ▲）
- "+Zpp" = 该取值在此群体中比全体均值高出 Z 个百分点
- ▲ = delta ≥ +5pp，即该取值在此群体中显著突出，是区分此群体的关键特征
- 未标 ▲、delta 接近 0 或为负数的取值不代表此群体的区分性特征

${fmtClusters(body.clusters)}

---
**合法字段取值（who_data / preference_data 的 values 必须严格来自此列表，一字不差）**
${fmtFieldOptions(body.fieldOptions)}

---

**任务**：为上述 ${body.optimalK} 个统计群体撰写洞察。
约束：
1. segments 数组顺序必须与上方群体顺序完全一致（群体1→群体2→…）
2. 不要输出 pct_estimate 字段（占比由系统自动注入）
3. **群体名称（name）和 who_data 的字段选择，只能基于标注了 ▲ 的字段取值**；未标 ▲ 的取值不得作为命名依据或 who_data 核心特征
4. who_data / preference_data 的 values 中每个值必须与上方合法取值列表完全一致

**A. 他们是谁** who_data：从核心维度选2-4个字段，每个字段只填最能支撑"谁在买车"结论的1-4个取值
**B. 为什么买** core_insight + insight_sections（3条：工作生活状态 / 消费汽车价值观 / 增换购前车品牌）
**C. 关注什么** preference_intro + preference_data（2-3个辅助字段，每个字段2-4个取值）
keywords：4个3-5字的判断性标签，高度概括消费心理特质

**输出（严格JSON，不输出其他内容）**
{
  "segments": [
    {
      "name": "群体描述名（精准，禁用人群A/B）",
      "keywords": ["关键词1", "关键词2", "关键词3", "关键词4"],
      "who_data": [
        { "field": "核心维度字段名", "values": ["取值A", "取值B"] }
      ],
      "core_insight": "消费动机核心引言",
      "insight_sections": [
        { "title": "工作生活状态", "text": "判断（含数字，可**加粗**）" },
        { "title": "消费/汽车价值观", "text": "判断（含数字，可**加粗**）" },
        { "title": "增换购/前车品牌", "text": "判断", "data": { "field": "字段名", "values": ["取值"] } }
      ],
      "preference_intro": "购车关注点核心特质",
      "preference_data": [
        { "field": "辅助字段名", "values": ["取值1", "取值2"] }
      ]
    }
  ],
  "overview": "整体一句话画像（含最显著特征，引用数据）"
}`;
}

// ── V1 prompt: legacy distribution-based ──────────────────────

function fmtDist(fields: FieldDist[]): string {
  return fields.map(f => {
    const rows = f.distribution
      .slice(0, 6)
      .map(d => `    ${d.value}: ${d.pct.toFixed(1)}%（${d.count}人）`)
      .join('\n');
    return `  【${f.name}】\n${rows}`;
  }).join('\n\n');
}

function buildPromptV1(body: ReqBodyV1): string {
  const clusterFieldNames = body.clusterFields.map(f => f.name).join('、');
  const suppNames         = body.supplementFields.map(f => f.name).join('、');
  return `你是麦肯锡资深市场研究专家，专注汽车行业用户细分研究。

核心原则：**所有数据都是为结论服务的**——先形成洞察，再选择最能支撑结论的数据点展示，不要罗列数据。

**数据背景**
- 数据集：${body.datasetName}
- 分析范围：${body.label}
- 有效样本：${body.totalCount.toLocaleString()} 份

**聚类核心维度**（${clusterFieldNames}）
${fmtDist(body.clusterFields)}

**辅助参考维度**：${suppNames || '（无）'}
${body.supplementFields.length > 0 ? fmtDist(body.supplementFields) : '（无）'}

---

**任务：识别2-4个人群群体，按以下框架分析，输出JSON**

⚠️ DataPoint 填写规则：values 中的取值名称必须与上方数据完全一致（含标点），渲染器将用它查找真实百分比。

**A. 他们是谁** who_data：从核心维度中选2-4个字段，每个字段只填最能支撑"谁在买车"结论的1-4个取值
**B. 为什么买** core_insight + insight_sections（3条：工作生活状态 / 消费汽车价值观 / 增换购前车品牌）
**C. 关注什么** preference_intro + preference_data（选2-3个辅助维度，每个只填最能说明结论的2-4个取值）

keywords：4个3-5字的判断性标签，高度概括消费心理特质

**输出（严格JSON，不输出其他内容）**
{
  "segments": [
    {
      "name": "群体描述名（精准，禁用人群A/B）",
      "pct_estimate": 35,
      "keywords": ["关键词1", "关键词2", "关键词3", "关键词4"],
      "who_data": [{ "field": "核心维度字段名", "values": ["取值A", "取值B"] }],
      "core_insight": "消费动机核心引言",
      "insight_sections": [
        { "title": "工作生活状态", "text": "判断（含数字，可**加粗**）" },
        { "title": "消费/汽车价值观", "text": "判断（含数字，可**加粗**）" },
        { "title": "增换购/前车品牌", "text": "判断", "data": { "field": "字段名", "values": ["取值"] } }
      ],
      "preference_intro": "购车关注点核心特质",
      "preference_data": [{ "field": "辅助字段名", "values": ["取值1", "取值2"] }]
    }
  ],
  "overview": "整体一句话画像（含最显著特征，引用数据）"
}`;
}

// ── DataPoint validation ───────────────────────────────────────

function validateDataPoints(
  dps: DataPoint[] | undefined,
  fieldOptions: Record<string, string[]>,
): DataPoint[] {
  if (!dps?.length) return dps ?? [];
  return dps
    .map(dp => {
      const opts = fieldOptions[dp.field];
      if (!opts?.length) return dp; // unknown field — pass through
      const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
      const validValues = dp.values
        .map(v => {
          const n = norm(v);
          if (opts.includes(n)) return n;
          return opts.find(o => norm(o).toLowerCase() === n.toLowerCase()) ?? null;
        })
        .filter((v): v is string => v !== null);
      return validValues.length ? { ...dp, values: validValues } : null;
    })
    .filter((dp): dp is DataPoint => dp !== null);
}

// ── JSON extraction ────────────────────────────────────────────

function extractJson(raw: string): string {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1);
  return raw.trim();
}

// ── Route handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json({ error: '未配置 AI_API_KEY' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const v2   = isV2(body);
    const prompt = v2 ? buildPromptV2(body as ReqBodyV2) : buildPromptV1(body as ReqBodyV1);

    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model:       AI_MODEL,
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  5000,
        temperature: 0.1,
      }),
    });

    if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`);

    const aiData = await res.json();
    const raw    = aiData.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(extractJson(raw)) as {
      segments: ClusterSegment[];
      overview?: string;
    };

    let segments = parsed.segments ?? [];

    if (v2) {
      // Merge server-computed pcts + validate AI-selected DataPoint values
      const { clusters, fieldOptions } = body as ReqBodyV2;
      segments = segments.map((seg, i) => {
        const cluster = clusters[i];
        // Build cluster-specific distributions for display (delta stripped — internal use only).
        // Only keep above-average values (delta >= 0) so UI bars stay meaningful.
        const clusterDist = cluster
          ? [...cluster.clusterFieldDist, ...cluster.supplementFieldDist]
              .map(fd => ({
                fieldName: fd.fieldName,
                topValues: fd.topValues
                  .filter(v => v.delta >= 0)
                  .map(v => ({ value: v.value, pct: v.pct })),
              }))
              .filter(d => d.topValues.length > 0)
          : undefined;
        return {
          ...seg,
          pct_estimate:     cluster?.pct ?? seg.pct_estimate,
          clusterDist,
          who_data:         validateDataPoints(seg.who_data, fieldOptions),
          preference_data:  validateDataPoints(seg.preference_data, fieldOptions),
          insight_sections: seg.insight_sections?.map(s => {
            if (!s.data) return s;
            const validated = validateDataPoints([s.data], fieldOptions);
            return { ...s, data: validated.length ? validated[0] : undefined };
          }),
        };
      });
    }

    const result: ClusterInsightResult = {
      segments,
      overview:    parsed.overview,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '聚类分析失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
