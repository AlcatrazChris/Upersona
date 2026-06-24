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
  clusterMethod?: 'kmeans' | 'twostage';
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
  const isTwoStage = body.clusterMethod === 'twostage';

  const methodDesc = isTwoStage
    ? `两阶段职业锚定聚类：先按从事行业/工作单位类型规则分组（体制内/制造工程/商贸服务/科技互联网/教育医疗/金融等），再在组内按收入水平 K-Means 细分。因此每个群体天然具有明确的行业身份，行业/单位类型字段的高集中度是分组设计的结果，不是偶然特征。`
    : `K-means + Calinski-Harabasz × 均衡惩罚，最优 k=${body.optimalK}`;

  const namingRule = isTwoStage
    ? `**群体名称（name）必须以该群体的主导行业/单位类型开头**，格式为「行业身份 + 收入/岗位特征」。
     示例：「政府事业单位·中高收入科级干部」「制造/建筑业·个体经营者」「商贸服务·批发零售中层」
     禁止使用与行业无关的抽象标签（如"品质升级型""首购族""新中产"）作为群体名称。`
    : `**群体名称（name）和 who_data 的字段选择，只能基于标注了 ▲ 的字段取值**；未标 ▲ 的取值不得作为命名依据或 who_data 核心特征`;

  const consistencyRule = `7. **内部一致性**：name/who_intro/core_insight/preference_detail 中的判断必须互相一致，不得出现自相矛盾（例如 name 写"首购"但 preference_detail 写"增购/换购动因"）。撰写前先通读该群体全部数据，确定是"首购为主"还是"增换购为主"，然后在所有字段中保持统一口径`;

  return `你是麦肯锡资深市场研究专家，专注汽车行业用户细分研究。

核心原则：**所有数据都是为结论服务的**——先形成洞察，再选择最能支撑结论的数据点展示，不要罗列数据。

**数据背景**
- 数据集：${body.datasetName}
- 分析范围：${body.label}
- 有效样本：${body.totalCount.toLocaleString()} 份

**聚类方法**：${methodDesc}
以下占比和样本量均为服务端精确计算值，**不要在输出中包含或改写这些数字**。

数据格式说明：XX%（全体YY%，+Zpp ▲）
- "+Zpp" = 该取值在此群体中比全体均值高出 Z 个百分点
- ▲ = delta ≥ +5pp，即该取值在此群体中显著突出，是区分此群体的关键特征
- 未标 ▲、delta 接近 0 或为负数的取值不代表此群体的区分性特征
${isTwoStage ? '- ⚠️ 两阶段聚类中，行业/单位类型字段的高集中度是**分组规则的结果**，请同时关注该群体在收入/岗位/学历等维度上的区分性特征（标 ▲ 的取值）' : ''}


${fmtClusters(body.clusters)}

---
**合法字段取值（who_data / preference_data 的 values 必须严格来自此列表，一字不差）**
${fmtFieldOptions(body.fieldOptions)}

---

**任务**：为上述 ${body.optimalK} 个群体撰写洞察。
约束：
1. segments 数组顺序必须与上方群体顺序完全一致（群体1→群体2→…）
2. 不要输出 pct_estimate 字段（占比由系统自动注入）
3. ${namingRule}
4. who_data / preference_data 的 values 中每个值必须与上方合法取值列表完全一致
5. **禁止在任何 text 字段中出现 "+Xpp"、"pp"、"高出X个百分点"、"差值" 等比较性写法**；只写绝对百分比（如"67%从事制造业"）
6. **职业/岗位/行业必须体现在 who_data 中**，描述精确到能帮助终端营销人员按行业+岗位定向寻找目标客户（如"制造/建筑行业中层管理者"而非泛泛的"企业员工"）
${consistencyRule}

**写作风格要求**：
- who_intro：**数据驱动型身份速写**，用绝对百分比直接勾勒人群面貌。${isTwoStage ? '必须以行业/单位身份开头。' : ''}
  示例：「从事制造业占60%、建筑业33%，以个体工商户为主（62%），家庭年收入集中在20-30万元（38%）。」
  格式：列出2-3个最能刻画该群体身份的维度和对应百分比，让读者一眼建立画面。
- core_insight：直指深层逻辑，有画面感。示例：「买车本质上是一次资产配置决策。他们长期处在制造业、建筑业，见惯营销套路，反感溢价，希望被当聪明的买主。」
- insight text：每条引用**≥2个不同维度的数据点**构建论证链（如学历+消费观→结论，行业+岗位→结论），不用同一维度的单一数据撑大结论。≤85字，可**加粗**关键词。
  示例：「**50%为大专及以下学历**，且**68%认为实用性最重要**，务实理性，反感营销溢价。他们看重车辆实际使用价值，对配置和性价比极度敏感。」

**A. 他们是谁**
  - who_intro：数据驱动型描述（2-3个维度 + 绝对百分比），≤60字
  - who_data：选3个字段，**必须覆盖3个不同维度类别**，从以下类别中各选1个最能区分该群体的字段：
    - 职业维度（从事行业 / 工作单位类型 / 岗位级别 / 职业类型，选1个最突出的）
    - 经济维度（家庭年收入 / 学历，选1个）
    - 生活维度（年龄段 / 工作生活状态 / 婚育情况，选1个与该群体最相关的）
    每字段填2-4个该群体最突出（delta ▲）的取值。**禁止3个字段全选职业相关维度**
**B. 为什么买** core_insight + insight_sections（3条）
  - 工作生活状态：工作性质 + 生活节奏 → 购车如何契合其生活场景
  - 消费/汽车价值观：消费理念 + 对车的态度 → 影响决策的核心价值取向。**必须交叉引用≥2个维度的数据**（如学历+消费观、收入+价值观），不能只用单一维度推导
  - 增换购/前车品牌：**前车品牌必须具名**（如"大众朗逸/丰田卡罗拉/BBA"等），说明换车动机与升级方向
**C. 关注什么**
  - preference_intro：1句话核心偏好特质
  - preference_detail：2-3句分析文本，综合购车动因、核心关注因素、决策信息来源等维度，揭示这群人"为什么关注这些"以及"如何做购车决策"。含绝对百分比数据。≤100字
  - preference_data：选2-3个最能佐证preference_detail结论的字段（如购车配置、家庭消费支出等），每字段2-4个取值
  - ⚠️ **数据筛选原则**：只展示能支撑论点的数据，去除与群体特征无关或构成反例的数据点。如果某维度在该群体中无明显特征（分布接近全体均值），不要展示

keywords：4个3-5字的判断性标签，高度概括消费心理特质

**输出（严格JSON，不输出其他内容）**
{
  "segments": [
    {
      "name": "${isTwoStage ? '行业身份·收入/岗位特征（如：政府事业单位·中高收入科级干部）' : '群体描述名（精准，禁用人群A/B）'}",
      "keywords": ["关键词1", "关键词2", "关键词3", "关键词4"],
      "who_intro": "从事XX占A%、YY占B%，以ZZ学历为主（C%），家庭年收入集中在D-E万元（F%）",
      "who_data": [
        { "field": "从事行业", "values": ["行业1", "行业2", "行业3"], "label": "职业维度" },
        { "field": "家庭年收入", "values": ["收入段1", "收入段2"], "label": "经济维度" },
        { "field": "年龄段/婚育情况", "values": ["取值1", "取值2"], "label": "生活维度" }
      ],
      "core_insight": "消费动机核心引言（直指深层逻辑，有画面感）",
      "insight_sections": [
        { "title": "工作生活状态", "text": "**A%处于X状态**，且B%表现Y——因此他们购车是[场景判断]" },
        { "title": "消费/汽车价值观", "text": "**A%具有X学历**，且**B%认为Y最重要**——[交叉维度揭示消费心理]" },
        { "title": "增换购/前车品牌", "text": "增换购需求以**新增/换购**为主，前车多为[大众/丰田/BBA等]，说明[换车动机]" }
      ],
      "preference_intro": "购车关注点核心特质（1句话）",
      "preference_detail": "综合分析：购车动因以XX为主（A%），核心关注XX和XX，决策时依赖XX信息（B%），说明这群人[偏好洞察]",
      "preference_data": [
        { "field": "辅助字段名", "values": ["取值1", "取值2"] }
      ]
    }
  ],
  "overview": "整体一句话画像（含最显著特征，引用绝对百分比数据）"
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

约束：
- **禁止在任何 text 字段中出现 "+Xpp"、"pp"、"高出X个百分点"、"差值" 等比较性写法**；只写绝对百分比
- **职业/岗位/行业必须体现在 who_data 中**，描述精确到能帮助寻找相似受众

**A. 他们是谁**
  - who_intro：数据驱动型描述（2-3个维度+绝对百分比），≤60字
  - who_data：选3个字段，必须覆盖3个不同维度类别（职业维度选1 + 经济维度选1 + 生活维度选1），禁止3个字段全选职业相关
**B. 为什么买** core_insight + insight_sections（3条：工作生活状态 / 消费/汽车价值观 / 增换购/前车品牌）
  - 每条 text 引用≥2个不同维度数据点构建论证链，含绝对百分比，≤85字，可**加粗**关键判断
  - 消费/汽车价值观必须交叉引用≥2个维度数据
  - 增换购/前车品牌必须具名（大众朗逸/丰田卡罗拉/BBA等），说明换车动机
**C. 关注什么**
  - preference_intro：1句偏好特质
  - preference_detail：2-3句综合分析（购车动因+关注因素+决策信息），含百分比，≤100字
  - preference_data：2-3个佐证字段，每字段2-4个取值。只展示支撑论点的数据

keywords：4个3-5字的判断性标签，高度概括消费心理特质

**输出（严格JSON，不输出其他内容）**
{
  "segments": [
    {
      "name": "群体描述名（精准，禁用人群A/B）",
      "pct_estimate": 35,
      "keywords": ["关键词1", "关键词2", "关键词3", "关键词4"],
      "who_intro": "从事XX占A%、YY占B%，以ZZ学历为主（C%），家庭年收入集中在D-E万元（F%）",
      "who_data": [
        { "field": "从事行业", "values": ["行业1", "行业2", "行业3"], "label": "职业维度" },
        { "field": "家庭年收入", "values": ["收入段1", "收入段2"], "label": "经济维度" },
        { "field": "年龄段/婚育情况", "values": ["取值1", "取值2"], "label": "生活维度" }
      ],
      "core_insight": "消费动机核心引言",
      "insight_sections": [
        { "title": "工作生活状态", "text": "**A%处于X状态**，且B%有Y特征——因此[场景判断]" },
        { "title": "消费/汽车价值观", "text": "**A%具有X学历**，且**B%认为Y最重要**——[交叉维度揭示心理]" },
        { "title": "增换购/前车品牌", "text": "增换购需求以**新增/换购**为主，前车多为[大众/丰田/BBA]，说明[换车动机]" }
      ],
      "preference_intro": "购车关注点核心特质",
      "preference_detail": "综合分析文本（含百分比，≤100字）",
      "preference_data": [{ "field": "辅助字段名", "values": ["取值1", "取值2"] }]
    }
  ],
  "overview": "整体一句话画像（含最显著特征，引用绝对百分比数据）"
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
  let json = '';
  if (m) {
    json = m[1].trim();
  } else {
    const start = raw.indexOf('{');
    const end   = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1) json = raw.slice(start, end + 1);
    else json = raw.trim();
  }
  // Try parse as-is first
  try { JSON.parse(json); return json; } catch { /* fall through to repair */ }
  // Attempt to repair truncated JSON by closing open brackets/braces
  let repaired = json;
  const opens: string[] = [];
  let inStr = false, escaped = false;
  for (const ch of repaired) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') opens.push(ch);
    if (ch === '}' || ch === ']') opens.pop();
  }
  if (inStr) repaired += '"';
  while (opens.length) {
    const o = opens.pop()!;
    repaired += o === '{' ? '}' : ']';
  }
  return repaired;
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

    const clusterCount = v2 ? (body as ReqBodyV2).optimalK : 3;
    const maxTokens = Math.min(8000, 800 * clusterCount + 500);
    const timeoutMs = Math.min(120_000, 15_000 * clusterCount + 10_000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
        body: JSON.stringify({
          model:       AI_MODEL,
          messages:    [{ role: 'user', content: prompt }],
          max_tokens:  maxTokens,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

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
    if (e instanceof Error && e.name === 'AbortError') {
      return NextResponse.json({ error: 'AI 分析超时，请稍后重试' }, { status: 504 });
    }
    const msg = e instanceof Error ? e.message : '聚类分析失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
