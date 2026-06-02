/**
 * 所有 AI Prompt 的默认值（代码兜底）。
 *
 * 管理员在后台修改后存入 ai_prompts 表；表中无对应行时使用此处默认值。
 * GET /api/prompts 启动时会自动将缺失的 prompt 写入 DB（ON CONFLICT DO NOTHING），
 * 确保管理界面始终显示全部 prompt 卡片。
 */

export interface SeedPrompt {
  prompt_key:  string;
  prompt_name: string;
  system_hint: string;
  user_prompt: string;
}

// ── 地域对比洞察 ──────────────────────────────────────────────
export const DEFAULT_COMPARE_PROMPT =
`你是华境S汽车品牌的用户研究分析师，正在分析【{orderNote}】用户群的「{dimensionLabel}」维度在不同地区之间的差异。

数据（各地区 TOP3 分布，含与均值的最大偏差）：
{regionLines}

各地区均值参考：{globalLine}

请从以下角度自由发挥，输出 3-5 句分析洞察：
1. 找出最显著的地区间差异（哪个地区在哪个维度上远高/低于均值）
2. 推断可能的原因（城市特征、消费结构、人口特点等）
3. 给出对华境S在该维度上的差异化运营建议（如果数据足够支撑）

语言风格：专业但生动，避免罗列数字，直接给出判断和建议。直接输出分析文字，不加标题或编号：`;

// ── 核心用户画像卡片 ──────────────────────────────────────────
export const DEFAULT_CORE_PROMPT =
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
}`;

// ── 地域画像差异总结（地域对比页 AI 汇总表）──────────────────────
export const DEFAULT_AREA_PORTRAIT_PROMPT =
`你是华境S汽车品牌的用户研究专家，为各{regionLabel}生成用户画像简述。
当前分析对象：{orderLabel}

【全国均值参考】
{natSummary}

【各{regionLabel}详细数据】
{areaLines}

【输出要求】
为每个{regionLabel}，按照以下7个固定维度，各写一段简短的描述性词语。

【描述规则——严格遵守】
- 只用描述性词语，不写数字和百分比
- 每条控制在5-12字，是短语而非完整句子
- 参考示例（严格照此风格）：
  职业：公职人员和白领为主
  年龄：主力年龄为35-44岁
  学历：本科为主，学历偏中等
  收入：家庭年收入15-19万为主
  家庭结构：四口之家为主，多代同堂特征明显
  消费观念：务实型为主，注重性价比
  对比车型：主要与吉利银河M9、零跑D19对比
- 如样本不足30人，在"职业"字段开头加"小样本，"

严格按此JSON格式返回，不输出其他内容：
{
  "areas": {
    "地域名": {
      "职业": "描述",
      "年龄": "描述",
      "学历": "描述",
      "收入": "描述",
      "家庭结构": "描述",
      "消费观念": "描述",
      "对比车型": "描述"
    }
  }
}`;

// ── 订单状态对比维度洞察 ──────────────────────────────────────
export const DEFAULT_STATUS_INSIGHT_PROMPT =
`你是华境S汽车用户研究专家，分析「{dimensionLabel}」维度下不同取值的订单状态分布差异。
筛选范围：{filter}
全局基准：{globalLine}

各取值订单状态分布：
{rowLines}

锁单率最高：{maxLockedLabel}（{maxLockedPct}%）
退单率最高：{maxCancelledLabel}（{maxCancelledPct}%）

请按以下两个部分输出，两部分之间空一行，纯文本格式不加任何Markdown符号（不加**、##、-等）：

核心差异：
直接说明锁单/提车用户在「{dimensionLabel}」上最集中的1-2个特征，与退单用户的具体数字对比。例如：锁单用户中35-39岁占61%，退单用户中该年龄段仅占42%。

原因分析：
如果两者差异显著（差值超过10%），分析背后的用户心理或决策逻辑。如果差异不显著，说明该维度对转化影响有限的可能原因。`;

// ── 订单状态对比概览洞察 ──────────────────────────────────────
export const DEFAULT_OVERVIEW_INSIGHT_PROMPT =
`你是华境S汽车用户研究专家。以下是各维度用户的订单状态分布（列内百分比，即各订单状态组内该维度取值的占比）：

{summaryLines}

请用2-3段纯文本（不加Markdown格式）分析：
1. 哪些维度的锁单用户与退单用户差异最显著？核心差异是什么？
2. 整体来看，什么样的用户特征与锁单率更相关？
每段直接陈述，不加标题和编号。`;

// ── 用户意向预测 ──────────────────────────────────────────────
export const DEFAULT_PREDICT_INTENT_PROMPT =
`你是华境S销售分析专家。基于用户画像，评估转化为锁单用户的概率（0-100分）。

{profileText}

严格按JSON返回，不输出其他内容：
{"score":数字,"keyFactors":["关键因素1","关键因素2","关键因素3"],"marketingAdvice":"针对性营销建议（25字内）"}`;

// ── 核心洞察分析字段配置（存为 JSON） ────────────────────────────
export const DEFAULT_INSIGHTS_FIELDS =
`[
  {"key":"occupation_raw","label":"原始职业","enabled":true,"type":"text"},
  {"key":"occupation_category","label":"职业分类","enabled":true,"type":"category"},
  {"key":"age_group","label":"年龄段","enabled":true,"type":"category"},
  {"key":"education","label":"学历","enabled":true,"type":"category"},
  {"key":"annual_income","label":"家庭年收入","enabled":true,"type":"category"},
  {"key":"family_structure","label":"家庭结构","enabled":true,"type":"category"},
  {"key":"is_upgrade","label":"是否增换购","enabled":true,"type":"category"},
  {"key":"consumption_views","label":"消费观念","enabled":true,"type":"multi"},
  {"key":"use_scenarios","label":"用车场景","enabled":true,"type":"multi"},
  {"key":"competing_models","label":"对比车型","enabled":true,"type":"multi"},
  {"key":"info_channels","label":"了解渠道","enabled":true,"type":"multi"},
  {"key":"car_interests","label":"关注内容","enabled":true,"type":"multi"},
  {"key":"hobbies","label":"日常爱好","enabled":true,"type":"multi"},
  {"key":"finance_term","label":"贷款期数","enabled":true,"type":"category"}
]`;

// ── 全量种子数据（GET /api/prompts 自动补全缺失行）─────────────
export const ALL_SEED_PROMPTS: SeedPrompt[] = [
  {
    prompt_key:  'compare_insight',
    prompt_name: '地域对比 AI 洞察',
    system_hint: '变量占位符：{dimensionLabel} {orderNote} {regionLines} {globalLine}',
    user_prompt: DEFAULT_COMPARE_PROMPT,
  },
  {
    prompt_key:  'core_card',
    prompt_name: '核心用户画像卡片',
    system_hint: '变量占位符：{region} {orderNote} {totalSamples} {strongCount} {strongRatio} {devText} {sampleRowsText} {statsText}',
    user_prompt: DEFAULT_CORE_PROMPT,
  },
  {
    prompt_key:  'area_portrait',
    prompt_name: '地域画像差异总结',
    system_hint: '变量占位符：{regionLabel} {orderLabel} {natSummary} {areaLines}（系统自动生成）',
    user_prompt: DEFAULT_AREA_PORTRAIT_PROMPT,
  },
  {
    prompt_key:  'status_insight',
    prompt_name: '状态对比维度洞察',
    system_hint: '变量占位符：{dimensionLabel} {filter} {globalLine} {rowLines} {maxLockedLabel} {maxLockedPct} {maxCancelledLabel} {maxCancelledPct}',
    user_prompt: DEFAULT_STATUS_INSIGHT_PROMPT,
  },
  {
    prompt_key:  'overview_insight',
    prompt_name: '状态对比概览洞察',
    system_hint: '变量占位符：{summaryLines}（各维度 TOP 数据汇总，系统自动生成）',
    user_prompt: DEFAULT_OVERVIEW_INSIGHT_PROMPT,
  },
  {
    prompt_key:  'predict_intent',
    prompt_name: '用户意向预测',
    system_hint: '变量占位符：{profileText}（用户画像字段列表，系统自动组装）',
    user_prompt: DEFAULT_PREDICT_INTENT_PROMPT,
  },
  {
    prompt_key:  'insights_fields',
    prompt_name: '核心洞察分析字段',
    system_hint: '控制哪些字段参与 AI 核心洞察分析。格式为 JSON 数组，每项包含 key/label/enabled/type。',
    user_prompt: DEFAULT_INSIGHTS_FIELDS,
  },
];
