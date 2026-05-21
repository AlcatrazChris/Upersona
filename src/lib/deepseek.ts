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

// ── 职业分类 ──
const OCCUPATION_CATEGORIES = ['管理层','专业人士','白领','公职','个体户','自媒体','蓝领','服务业','自由职业','其他'];

export async function classifyOccupations(rawTexts: string[]): Promise<Record<string, string>> {
  if (rawTexts.length === 0) return {};
  const prompt = `你是职业分类专家。将下列职业描述分别归入以下10类之一：
1.管理层（总经理/高管/经理/总监/企业主）2.专业人士（工程师/IT/医生/教师/律师/设计师）
3.白领（职员/文员/行政/HR/金融/销售）4.公职（公务员/事业单位/国企/警察）
5.个体户（个体经营/小老板/自营/开店）6.自媒体（自媒体/主播/UP主）
7.蓝领（工厂/建筑/驾驶员/电工/技工/农民）8.服务业（服务员/保安/快递/外卖/导购）
9.自由职业（自由职业/灵活就业）10.其他（学生/退休/无业/无法判断）
待分类：\n${rawTexts.map((t,i)=>`${i+1}. ${t}`).join('\n')}
严格按此JSON返回：{"results":[{"raw":"原文","category":"分类"}]}`;
  const content = await chat([{ role: 'user', content: prompt }], 0.1);
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Invalid JSON from DeepSeek');
  const parsed = JSON.parse(m[0]) as { results: { raw: string; category: string }[] };
  return Object.fromEntries(parsed.results.map(r => [r.raw, OCCUPATION_CATEGORIES.includes(r.category) ? r.category : '其他']));
}

// ── 地域对比洞察 ──
export async function generateCompareInsight(params: {
  dimension: string; dimensionLabel: string; orderStatus: string;
  regions: { name: string; sampleCount: number; distribution: { label: string; percentage: number }[] }[];
}): Promise<string> {
  const { dimensionLabel, orderStatus, regions } = params;
  const orderNote = orderStatus === 'all' ? '全部订单用户' : `${orderStatus}用户`;
  const dataDesc = regions.map(r =>
    `${r.name}(n=${r.sampleCount})：前三为 ${r.distribution.slice(0,3).map(d=>`${d.label}(${d.percentage.toFixed(1)}%)`).join('、')}`
  ).join('\n');
  return chat([{ role:'user', content:`你是汽车市场分析师。基于【${orderNote}】的${dimensionLabel}数据，2-3句话写地区对比洞察，突出最显著差异，语言简洁直接。\n数据：\n${dataDesc}\n直接输出洞察：` }], 0.5);
}

// ── 核心用户画像卡片（带全国均值偏差）──
export async function generateCoreUserCard(params: {
  region: string; orderStatus: string;
  totalSamples: number; strongCount: number; weakCount: number; strongRatio: number;
  stats: {
    topOccupations:      { label: string; count: number; pct: number }[];
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
  // 与全国均值的偏差（正数=高于全国）
  deviations: { dimension: string; local: number; national: number; diff: number; label: string }[];
}): Promise<{
  title: string;
  bullets: [string, string, string, string];
  tags: { age?: string; income?: string; competing?: string; attitude?: string; extra?: string };
}> {
  const { region, orderStatus, totalSamples, strongCount, strongRatio, stats, deviations } = params;
  const orderNote = orderStatus === 'all' ? '全部订单' : orderStatus;

  // 找出偏差最大的 3 个特征（供 AI 生成差异化标题）
  const topDevs = [...deviations].sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0,3);
  const devText = topDevs.map(d =>
    `${d.label}：地区${d.local.toFixed(1)}% vs 全国${d.national.toFixed(1)}%（差异${d.diff>0?'+':''}${d.diff.toFixed(1)}%）`
  ).join('\n');

  const statsText = [
    `职业TOP3：${stats.topOccupations.slice(0,3).map(o=>`${o.label}(${o.pct}%)`).join('、')}`,
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
  ].join('\n');

  const prompt = `你是汽车用户研究专家，正在为${region}地区的华境S潜在用户（${orderNote}，共${totalSamples}人，强意向${strongCount}人占${strongRatio}%）生成画像卡片。

【该地区与全国均值的最显著偏差（重点！标题必须体现这些差异）】：
${devText}

【完整数据统计】：
${statsText}

标题要求（最重要）：
- 格式：TOP职业关键词 · 该地区最鲜明的区别性特征
- 必须基于偏差数据，找出该地区与全国差异最大的特征写入标题
- 禁止使用：务实/理性/换购/家庭——除非这是该地区最显著的偏差项
- 示例风格：「IT/金融从业者 · 科技感导向」「个体户 · 三口之家为主力」「公职群体 · 换购需求突出」

请严格按以下JSON返回，不输出其他内容：
{
  "title": "职业 · 地域最显著特征（8-15字）",
  "bullets": [
    "人群基本信息：年龄/学历/收入/家庭结构的具体数据描述（含数字）",
    "人群兴趣点：关注内容+了解渠道+爱好的结合描述",
    "消费习惯预测：基于消费观念+用车场景+对比车型推断该群体的购车逻辑",
    "营销建议：针对${region}该人群的1条具体可执行的营销建议"
  ],
  "tags": {
    "age": "最主要年龄段",
    "income": "主要收入区间",
    "competing": "最主要对比车型",
    "attitude": "购车核心态度（4字以内）",
    "extra": "该地区最鲜明的1个区别性特征（4字以内）"
  }
}`;

  const content = await chat([{ role: 'user', content: prompt }], 0.6);
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('DeepSeek returned invalid JSON for core user card');
  return JSON.parse(m[0]);
}
