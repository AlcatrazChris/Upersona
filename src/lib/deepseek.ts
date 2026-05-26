const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

interface Message { role: 'system' | 'user' | 'assistant'; content: string; }

async function chat(messages: Message[], temperature = 0.3): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, temperature, max_tokens: 1400 }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`DeepSeek API error ${res.status}: ${err}`); }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ── 健壮的 JSON 提取工具 ──────────────────────────────────────
// DeepSeek 有时会在 JSON 前后加解释文字，这里提取最外层的完整 JSON 对象
function extractJSON(raw: string): Record<string, unknown> {
  const text = raw.trim();
  // 先找最后一个 } 和最前一个 { 配对的完整 JSON
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`DeepSeek returned invalid JSON. Raw: ${text.slice(0, 200)}`);
  }
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // 尝试修复常见问题：末尾多余逗号
    const fixed = candidate.replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error(`DeepSeek JSON parse failed. Candidate: ${candidate.slice(0, 300)}`);
    }
  }
}

// ── 从数据库读取 prompt 模板（有缓存降级到默认值）──────────────
const promptCache: Record<string, { text: string; ts: number }> = {};
const PROMPT_TTL = 60 * 1000; // 1 分钟内复用缓存，避免每次调 DB

export function clearPromptCache(key?: string) {
  if (key) delete promptCache[key];
  else Object.keys(promptCache).forEach(k => delete promptCache[k]);
}

async function getPrompt(key: string, defaultPrompt: string): Promise<string> {
  const now = Date.now();
  if (promptCache[key] && now - promptCache[key].ts < PROMPT_TTL) {
    return promptCache[key].text;
  }
  try {
    const { createServiceClient } = await import('@/lib/supabase');
    const db = createServiceClient();
    const { data } = await db.from('ai_prompts').select('user_prompt').eq('prompt_key', key).single();
    if (data?.user_prompt) {
      promptCache[key] = { text: data.user_prompt, ts: now };
      return data.user_prompt;
    }
  } catch {
    // DB 读取失败时降级到默认 prompt
  }
  return defaultPrompt;
}

// ── 新 8 类职业分类 ──────────────────────────────────────────
const OCCUPATION_CATEGORIES = [
  '管理人员', '工程技术人员', '白领', '公职人员',
  '个体户', '基层劳动者', '自由职业', '其他',
];

// ── 本地职业分类规则（与 seed.mjs 保持一致）──
const LOCAL_OCC_RULES: { kw: string[]; cat: string }[] = [
  { kw: ['公务员','警察','教师','医生','军人','事业单位','编制','公职','国企','机关',
         '政府','事业编','老师','护士','医务','军队','部队','武警','海关','央企'], cat: '公职人员' },
  { kw: ['总经理','董事长','总监','主管','经理','高管','ceo','coo','cto','负责人',
         '创始','投资人','企业主','企业负责人','企业管理人员','企业管理','商业管理',
         '管理人员','私企管理'], cat: '管理人员' },
  { kw: ['工程师','程序员','开发','技术','it','设计师','会计','律师','建筑师','架构',
         '研发','科研','工程类','工程','土木','机械','电气','电力','通讯','通信',
         '互联网','信息','轨道交通','高铁','汽车制造','电子','质检','检测','咨询',
         '财务','兽医','新媒体','教育行业','建筑业','医疗'], cat: '工程技术人员' },
  { kw: ['职员','文员','行政','hr','运营','市场','销售','客服','金融','审计','策划',
         '文职','业务员','业务','外勤','传媒','银行','保险','证券','电商','汽车营销',
         '培训','上班族','上班','普通职工','企业职工','企业职员','员工','公司员工',
         '公司职员','企业员工','工作人员','职工','普通员工','车企员工','白领'], cat: '白领' },
  { kw: ['个体','老板','私营','自营','开店','做生意','小老板','经商','经营',
         '自有公司','小作坊','零售','物业管理','全屋定制','装饰工程'], cat: '个体户' },
  { kw: ['工人','蓝领','司机','驾驶','电工','技工','建筑工','体力','搬运','农','渔',
         '厨师','工厂','务工','制造业','安装','服务类','服务行业','服务人员','服务业',
         '保安','物流','快递','外卖','保洁','保姆','餐饮','物业'], cat: '基层劳动者' },
  { kw: ['自由','宝妈','全职妈','自媒体','主播','up主','博主','斜杠',
         '在家带娃','灵活就业','导演','摄影师'], cat: '自由职业' },
  { kw: ['学生','退休','无业','待业','失业','离休','保密','老百姓','牛马'], cat: '其他' },
];

function classifyOccLocal(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (!lower || ['nan','-','/','?','？','无'].includes(lower)) return '其他';
  for (const { kw, cat } of LOCAL_OCC_RULES) {
    if (kw.some(k => lower.includes(k))) return cat;
  }
  return '其他';
}

export async function classifyOccupations(rawTexts: string[]): Promise<Record<string, string>> {
  if (rawTexts.length === 0) return {};

  // 第一阶段：本地规则先跑，只把还是"其他"的送 DeepSeek
  const preClassified: Record<string, string> = {};
  const needAI: string[] = [];
  for (const t of rawTexts) {
    const local = classifyOccLocal(t);
    if (local !== '其他') preClassified[t] = local;
    else needAI.push(t);
  }

  if (needAI.length === 0) return preClassified;

  const prompt =
`你是职业分类专家。将下列职业描述分别归入以下8类之一：
1. 管理人员（总经理/副总/高管/总监/经理/主管/负责人/创始人/投资人/董事等）
2. 工程技术人员（工程师/IT/程序员/开发/设计师/会计/律师/医师/技术/研发/科研人员等）
3. 白领（职员/文员/行政/HR/运营/市场/销售/客服/金融/采购/助理等非技术普通岗位）
4. 公职人员（公务员/军人/警察/教师/医生/护士/事业单位/国企/编制）
5. 个体户（个体户/小老板/私营业主/自营/开店/经商）
6. 基层劳动者（工人/蓝领/驾驶员/电工/技工/建筑工/农民/快递/外卖/保安/服务员/厨师等）
7. 自由职业（自由职业者/自媒体/主播/博主/宝妈/全职妈妈/灵活就业）
8. 其他（学生/退休/离休/无业/无法判断/符号/笔名等）

仅对以下本地规则无法判断的职业进行分类：
${needAI.map((t,i) => `${i+1}. ${t}`).join('\n')}

严格按此JSON返回，不输出其他内容：{"results":[{"raw":"原文","category":"分类"}]}`;

  const result = await chat([{ role: 'user', content: prompt }], 0.1);
  const parsed = extractJSON(result) as { results: { raw: string; category: string }[] };
  const aiClassified = Object.fromEntries(
    parsed.results.map(r => [r.raw, OCCUPATION_CATEGORIES.includes(r.category) ? r.category : classifyOccLocal(r.raw)])
  );
  return { ...preClassified, ...aiClassified };
}

// ── 地域对比洞察（大自由度，从差异切入）────────────────────────
export async function generateCompareInsight(params: {
  dimension: string;
  dimensionLabel: string;
  orderStatus: string;
  regions: {
    name: string;
    sampleCount: number;
    distribution: { label: string; percentage: number }[];
  }[];
}): Promise<string> {
  const { dimensionLabel, orderStatus, regions } = params;
  const orderNote = orderStatus === 'all' ? '全部订单' : `${orderStatus}`;

  // 计算各地区 TOP 1 及占比，和总体中位值，让 AI 有计算基础
  const allLabels = [...new Set(regions.flatMap(r => r.distribution.map(d => d.label)))];
  const globalAvg: Record<string, number> = {};
  for (const label of allLabels) {
    const vals = regions.map(r => r.distribution.find(d => d.label === label)?.percentage ?? 0);
    globalAvg[label] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
  }

  const regionLines = regions.map(r => {
    const top3 = r.distribution.slice(0, 3).map(d => `${d.label} ${d.percentage.toFixed(1)}%`).join('、');
    // 找出与全体均值偏差最大的项
    const bigDiff = r.distribution
      .map(d => ({ label: d.label, diff: d.percentage - (globalAvg[d.label] ?? 0) }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
    const diffStr = bigDiff
      ? `（最大偏差：${bigDiff.label} ${bigDiff.diff > 0 ? '+' : ''}${bigDiff.diff.toFixed(1)}%）`
      : '';
    return `• ${r.name}（n=${r.sampleCount}）：${top3} ${diffStr}`;
  }).join('\n');

  const globalLine = Object.entries(globalAvg)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([l, v]) => `${l} ${v}%`).join('、');

  // 默认 prompt 模板（用占位符，不用 JS 插值）
  const DEFAULT_COMPARE_PROMPT =
`你是华境S汽车品牌的用户研究分析师，正在分析【{orderNote}】用户群的「{dimensionLabel}」维度在不同地区之间的差异。

数据（各地区 TOP3 分布，含与均值的最大偏差）：
{regionLines}

各地区均值参考：{globalLine}

请从以下角度自由发挥，输出 3-5 句分析洞察：
1. 找出最显著的地区间差异（哪个地区在哪个维度上远高/低于均值）
2. 推断可能的原因（城市特征、消费结构、人口特点等）
3. 给出对华境S在该维度上的差异化运营建议（如果数据足够支撑）

语言风格：专业但生动，避免罗列数字，直接给出判断和建议。直接输出分析文字，不加标题或编号：`;

  // 从 DB 读取（管理员可覆盖），再把占位符替换为实际数据
  const template = await getPrompt('compare_insight', DEFAULT_COMPARE_PROMPT);
  const finalPrompt = template
    .replace('{dimensionLabel}', dimensionLabel)
    .replace('{orderNote}', orderNote)
    .replace('{regionLines}', regionLines)
    .replace('{globalLine}', globalLine);

  return chat([{ role: 'user', content: finalPrompt }], 0.75);
}

// ── 核心用户画像卡片（带全国均值偏差 + 原始职业文本）───────────
export async function generateCoreUserCard(params: {
  region: string;
  orderStatus: string;
  totalSamples: number;
  strongCount: number;
  weakCount: number;
  strongRatio: number;
  stats: {
    topOccupations:      { label: string; count: number; pct: number }[];
    topOccupationRaw:    { label: string; count: number; pct: number }[];  // 原始职业 TOP
    topAgeGroups:        { label: string; count: number; pct: number }[];
    topEducation:        { label: string; count: number; pct: number }[];
    topIncome:           { label: string; count: number; pct: number }[];
    topFamilyStructure:  { label: string; count: number; pct: number }[];
    topCarInterests:     { label: string; count: number; pct: number }[];
    topInfoChannels:     { label: string; count: number; pct: number }[];
    topConsumptionViews: { label: string; count: number; pct: number }[];
    topHobbies:          { label: string; count: number; pct: number }[];
    topCompetingModels:  { label: string; count: number; pct: number }[];
    topUseScenarios:     { label: string; count: number; pct: number }[];
    isUpgrade:           { label: string; count: number; pct: number }[];
  };
  deviations: { dimension: string; local: number; national: number; diff: number; label: string }[];
  sampleUserRows: string[];
  financeRate: {
    financeRate: number;
    avgTerm: number;
    financeCount: number;
    byIncome: { income: string; n: number; finPct: number }[];
  };
}): Promise<{
  title: string;
  bullets: [string, string, string, string];
  tags: { age?: string; income?: string; competing?: string; attitude?: string; extra?: string };
}> {
  const { region, orderStatus, totalSamples, strongCount, strongRatio, stats, deviations, sampleUserRows, financeRate } = params;
  const orderNote = orderStatus === 'all' ? '全部订单' : orderStatus;

  // 偏差 TOP 3
  const topDevs = [...deviations].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3);
  const devText = topDevs.map(d =>
    `${d.label}：本地 ${d.local.toFixed(1)}% vs 全国均值 ${d.national.toFixed(1)}%（差 ${d.diff > 0 ? '+' : ''}${d.diff.toFixed(1)}%）`
  ).join('\n');

  // 原始职业 TOP 5（最能体现地域特色的原始表述）
  const rawOccText = stats.topOccupationRaw.slice(0, 5)
    .map(o => `${o.label}(${o.pct}%)`)
    .join('、');

  // 金融决策摘要
  const financeText = (() => {
    const { financeRate: fr, avgTerm, byIncome } = financeRate;
    const incomeHighFin = byIncome.filter(r => r.finPct > fr + 10).map(r => `${r.income}(${r.finPct}%)`).join('、');
    const incomeLowFin  = byIncome.filter(r => r.finPct < fr - 10 && r.n >= 5).map(r => `${r.income}(${r.finPct}%)`).join('、');
    let txt = `分期比例${fr}%，平均${avgTerm}期`;
    if (incomeHighFin) txt += `；${incomeHighFin}分期倾向高于均值`;
    if (incomeLowFin)  txt += `；${incomeLowFin}分期倾向低于均值`;
    return txt;
  })();

  const statsText = [
    `职业大类TOP3：${stats.topOccupations.slice(0,3).map(o=>`${o.label}(${o.pct}%)`).join('、')}`,
    `原始职业TOP5（体现地域特色）：${rawOccText}`,
    `年龄TOP2：${stats.topAgeGroups.slice(0,2).map(a=>`${a.label}(${a.pct}%)`).join('、')}`,
    `学历TOP2：${stats.topEducation.slice(0,2).map(e=>`${e.label}(${e.pct}%)`).join('、')}`,
    `收入TOP2：${stats.topIncome.slice(0,2).map(i=>`${i.label}(${i.pct}%)`).join('、')}`,
    `家庭结构TOP2：${stats.topFamilyStructure.slice(0,2).map(f=>`${f.label}(${f.pct}%)`).join('、')}`,
    `关注内容TOP3：${stats.topCarInterests.slice(0,3).map(c=>`${c.label}(${c.pct}%)`).join('、')}`,
    `了解渠道TOP3：${stats.topInfoChannels.slice(0,3).map(c=>`${c.label}(${c.pct}%)`).join('、')}`,
    `消费观TOP2：${stats.topConsumptionViews.slice(0,2).map(c=>`${c.label}(${c.pct}%)`).join('、')}`,
    `爱好TOP3：${stats.topHobbies.slice(0,3).map(h=>`${h.label}(${h.pct}%)`).join('、')}`,
    `对比车型TOP2：${stats.topCompetingModels.slice(0,2).map(m=>`${m.label}(${m.pct}%)`).join('、')}`,
    `用车场景TOP2：${stats.topUseScenarios.slice(0,2).map(s=>`${s.label}(${s.pct}%)`).join('、')}`,
    `增换购：${stats.isUpgrade[0]?.label}(${stats.isUpgrade[0]?.pct}%)`,
    `金融决策：${financeText}`,
  ].join('\n');

  // 构建样本行文本（用于 AI 聚类）
  const sampleRowsText = sampleUserRows.length > 0
    ? sampleUserRows.map((r, i) => `第${i+1}人: ${r}`).join('\n')
    : '（无样本行数据）';

  // 默认 prompt 模板（用占位符，不用 JS 插值）
  const DEFAULT_CORE_PROMPT =
`你是汽车用户研究专家，擅长从原始用户数据中发现有价值的人群规律。

【任务背景】
分析{region}地区华境S潜在用户（{orderNote}），共{totalSamples}人，强意向{strongCount}人（占{strongRatio}%）。

【该地区与全国均值的显著差异】
{devText}

【原始样本行（每行是一个真实用户，字段顺序：职业|年龄|收入|家庭结构|学历|增换购|付款方式|消费观念|用车场景|对比车型|了解渠道）】
{sampleRowsText}

【维度统计汇总（辅助参考）】
{statsText}

---

【你的任务】

**第一步：聚类**
阅读原始样本行，将这些用户归纳为1-2个有辨识度的人群群体（不要机械列出所有职业，而是找到"什么样的人"买这辆车）。
- 职业要合并同类项：把"信息相关/分析师/IT"统一描述为"科技/信息从业者"；把"矿工/制造业/技工"统一描述为"工矿/制造业从业者"
- 找交叉特征：一个有价值的聚类是"35-45岁、三口之家、收入20-30万、偏好自驾游的换购用户"，而不是单独列"35-45岁占X%，三口之家占X%"
- 如果样本太少（<10人），在描述时注明"小样本，仅供参考"

**第二步：找地域特色**
对比{devText}中的偏差数据，该地区与全国相比最突出的1-2个特征是什么？这个特征要写进标题。

**第三步：输出卡片**
基于聚类结果输出如下JSON，语言要让门店销售看得懂、能落地执行：

{
  "title": "主导人群的具体职业描述 · 该地区最突出的一个特征（8-15字，职业要具体，如：工矿/制造业从业者 · 大家庭换购需求）",
  "bullets": [
    "人群画像：用1-2句话描述最主要的人群组合（职业+收入+家庭+年龄要交叉描述，如：'核心群体是35-45岁、三口或四口之家的工矿/制造业从业者，家庭年收入15-25万，以换购为主'），避免逐项列数字",
    "购车驱动与付款决策：结合用车场景+对比车型+消费观+金融决策数据，推断购车动机和付款偏好（如：分期比例高+收入偏低 → 月供敏感型；全款为主+收入中等 → 一次性决策型）。重点说明该地区是否存在明显的金融需求特征。",
    "触媒习惯：这群人在哪里、通过什么方式获取汽车信息？结合了解渠道+爱好+信息偏好给出具体描述（如：'主要通过抖音短视频了解新车，偏好真实用车场景测评，周末有户外出行习惯'）",
    "门店行动建议：针对{region}这一人群，给门店1条具体可执行的建议，要指向明确的触达方式或销售话术（如：'在4S店展厅重点展示第三排空间和折叠方式，准备低月供方案，触达工矿企业职工群体'）"
  ],
  "tags": {
    "age": "主要年龄段",
    "income": "主要收入区间",
    "competing": "最主要对比车型",
    "attitude": "购车核心动机（4字）",
    "extra": "地域最突出特征（4字）"
  }
}`
  // 从 DB 读取覆盖版 prompt（管理员可修改），再替换占位符
  const template = await getPrompt('core_card', DEFAULT_CORE_PROMPT);
  const finalPrompt = template
    .replace(/\{region\}/g, region)
    .replace('{orderNote}', orderNote)
    .replace('{totalSamples}', String(totalSamples))
    .replace('{strongCount}', String(strongCount))
    .replace('{strongRatio}', String(strongRatio))
    .replace('{devText}', devText)
    .replace('{rawOccText}', rawOccText)
    .replace('{sampleRowsText}', sampleRowsText)
    .replace('{statsText}', statsText);

  const result = await chat([{ role: 'user', content: finalPrompt }], 0.65);
  return extractJSON(result) as { title: string; bullets: [string, string, string, string]; tags: { age?: string; income?: string; competing?: string; attitude?: string; extra?: string } };
}

// ── 意向预测（保留导出，供旧代码引用）────────────────────────
export async function predictUserIntent(userProfile: {
  ageGroup: string; education: string; occupation: string; familyStructure: string;
  income: string; isUpgrade: string; consumptionViews: string[]; useScenarios: string[];
  carInterests: string[]; infoChannels: string[]; hobbies: string[]; competingModels: string[];
  familyTripFreq: string[]; city: string; province: string; area: string;
}): Promise<{ score: number; keyFactors: string[]; marketingAdvice: string }> {
  const profileText = Object.entries({
    '城市': `${userProfile.city}（${userProfile.province}，${userProfile.area}）`,
    '年龄': userProfile.ageGroup, '学历': userProfile.education,
    '职业': userProfile.occupation, '家庭': userProfile.familyStructure,
    '收入': userProfile.income, '增换购': userProfile.isUpgrade,
    '消费观念': userProfile.consumptionViews.join('、'),
    '用车场景': userProfile.useScenarios.join('、'),
    '关注内容': userProfile.carInterests.join('、'),
    '了解渠道': userProfile.infoChannels.join('、'),
    '爱好': userProfile.hobbies.join('、'),
    '对比车型': userProfile.competingModels.join('、'),
    '出行频率': userProfile.familyTripFreq.join('、'),
  }).map(([k, v]) => `${k}：${v}`).join('\n');

  const content = await chat([{
    role: 'user',
    content: `你是华境S销售分析专家。基于用户画像，评估转化为锁单用户的概率（0-100分）。\n\n${profileText}\n\n严格按JSON返回：\n{"score":数字,"keyFactors":["因素1","因素2","因素3"],"marketingAdvice":"针对性营销建议（25字内）"}`,
  }], 0.3);
  return extractJSON(content) as { score: number; keyFactors: string[]; marketingAdvice: string };
}

// ── 订单状态对比洞察 ──────────────────────────────────────────
const DEFAULT_STATUS_INSIGHT_PROMPT =
`你是华境S汽车用户研究专家，分析「{dimensionLabel}」维度下不同取值的订单状态分布差异。
筛选范围：{filter}
全局基准：{globalLine}

各取值订单状态分布：
{rowLines}

锁单率最高：{maxLocked}
退单率最高：{maxCancelled}

请按以下两个部分输出，两部分之间空一行，纯文本格式不加任何Markdown符号（不加**、##、-等）：

核心差异：
直接说明锁单/提车用户在「{dimensionLabel}」上最集中的1-2个特征，与退单用户的具体数字对比。例如：锁单用户中35-39岁占61%，退单用户中该年龄段仅占42%。

原因分析：
如果两者差异显著（差值超过10%），分析背后的用户心理或决策逻辑。如果差异不显著，说明该维度对转化影响有限的可能原因。`;

export async function generateStatusInsight(params: {
  dimensionLabel: string;
  filter: string;
  rows: {
    label: string;
    total: number;
    statusCounts: { status: string; count: number; pct: number }[];
  }[];
  globalStatus: { status: string; count: number; pct: number }[];
}): Promise<string> {
  const { dimensionLabel, filter, rows, globalStatus } = params;

  const globalLine = globalStatus.map(s => `${s.status} ${s.pct}%`).join(' / ');

  const lockedIdx    = 0;
  const cancelledIdx = 2;

  const rowLines = rows.map(r => {
    const locked    = r.statusCounts[lockedIdx];
    const pending   = r.statusCounts[1];
    const cancelled = r.statusCounts[cancelledIdx];
    return `• ${r.label}(n=${r.total})：锁单/提车 ${locked.pct}% / 未锁单 ${pending.pct}% / 退单 ${cancelled.pct}%`;
  }).join('\n');

  const maxLocked    = rows.reduce((a, b) => a.statusCounts[lockedIdx].pct    > b.statusCounts[lockedIdx].pct    ? a : b);
  const maxCancelled = rows.reduce((a, b) => a.statusCounts[cancelledIdx].pct > b.statusCounts[cancelledIdx].pct ? a : b);

  const template = await getPrompt('status_insight', DEFAULT_STATUS_INSIGHT_PROMPT);
  const finalPrompt = template
    .replace(/\{dimensionLabel\}/g, dimensionLabel)
    .replace('{filter}', filter || '全国')
    .replace('{globalLine}', globalLine)
    .replace('{rowLines}', rowLines)
    .replace('{maxLocked}', `${maxLocked.label}（${maxLocked.statusCounts[lockedIdx].pct}%）`)
    .replace('{maxCancelled}', `${maxCancelled.label}（${maxCancelled.statusCounts[cancelledIdx].pct}%）`);

  return chat([{ role: 'user', content: finalPrompt }], 0.7);
}