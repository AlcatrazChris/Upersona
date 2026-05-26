-- 运行此 SQL 在 Supabase SQL Editor 中一次性执行
-- AI Prompt 配置表
create table if not exists ai_prompts (
  id           serial primary key,
  prompt_key   text not null unique,   -- 标识符，如 'compare_insight' / 'core_card'
  prompt_name  text not null,          -- 显示名称
  system_hint  text not null default '',   -- 系统说明（只读，给管理员看的）
  user_prompt  text not null,          -- 可编辑的 prompt 模板
  updated_at   timestamptz not null default now(),
  updated_by   text not null default 'admin'
);

-- RLS
alter table ai_prompts enable row level security;
create policy "service role full access" on ai_prompts
  using (true) with check (true);

-- 插入默认 prompt（会被代码中的默认值覆盖，可在管理后台修改）
insert into ai_prompts (prompt_key, prompt_name, system_hint, user_prompt) values
(
  'compare_insight',
  '地域对比 AI 洞察',
  '变量占位符：{dimensionLabel} {orderNote} {regionLines} {globalLine}',
  '你是华境S汽车品牌的用户研究分析师，正在分析【{orderNote}】用户群的「{dimensionLabel}」维度在不同地区之间的差异。

数据（各地区 TOP3 分布，含与均值的最大偏差）：
{regionLines}

各地区均值参考：{globalLine}

请从以下角度自由发挥，输出 3-5 句分析洞察：
1. 找出最显著的地区间差异（哪个地区在哪个维度上远高/低于均值）
2. 推断可能的原因（城市特征、消费结构、人口特点等）
3. 给出对华境S在该维度上的差异化运营建议（如果数据足够支撑）

语言风格：专业但生动，避免罗列数字，直接给出判断和建议。直接输出分析文字，不加标题或编号：'
),
(
  'core_card',
  '核心用户画像卡片',
  '变量占位符：{region} {orderNote} {totalSamples} {strongCount} {strongRatio} {devText} {rawOccText} {statsText}',
  '你是汽车用户研究专家，正在为{region}地区的华境S潜在用户（{orderNote}，共{totalSamples}人，强意向{strongCount}人占{strongRatio}%）生成用户画像卡片。

【该地区与全国均值的最显著差异（生成标题时必须体现）】：
{devText}

【原始职业文本 TOP5（提供地域职业细节，优先用于标题和描述）】：
{rawOccText}

【完整数据统计】：
{statsText}

标题要求（最重要）：
- 格式：具体职业名称 · 该地区最鲜明的区别性特征
- 具体职业名称：优先使用原始职业 TOP5 里最有代表性的具体职称（如"IT工程师/证券从业者"而非"工程技术人员"）
- 最鲜明特征：必须是与全国差异最大的维度，用精炼短语表达
- 禁止使用通用词：务实/理性/换购/家庭——除非这是该地区最显著的偏差项
- 示例：「IT/金融从业者 · 科技感主导」「教师/公务员 · 三口之家换购主力」「个体老板 · 高频家庭出行需求」

请严格按以下JSON返回，不输出其他内容：
{
  "title": "具体职业 · 地域最显著特征（8-15字）",
  "bullets": [
    "人群基本信息：结合原始职业文本和年龄/学历/收入/家庭结构，写出有地域质感的描述，含具体数字",
    "人群兴趣点：关注内容+了解渠道+爱好的组合，描述信息获取方式和生活方式特点",
    "消费习惯预测：基于消费观念+用车场景+对比车型，推断该群体在选车时的核心考量和决策逻辑",
    "营销建议：针对{region}该人群特点，给出1条具体可执行的触达/转化建议"
  ],
  "tags": {
    "age": "最主要年龄段",
    "income": "主要收入区间",
    "competing": "最主要对比车型（1-2个）",
    "attitude": "购车核心态度（4字以内）",
    "extra": "该地区最鲜明的1个区别性特征（4字以内）"
  }
}'
)
on conflict (prompt_key) do nothing;

-- 订单状态对比洞察 prompt
INSERT INTO ai_prompts (prompt_key, prompt_name, system_hint, user_prompt)
VALUES (
  'status_insight',
  '订单状态对比 AI 洞察',
  '变量占位符：{dimensionLabel}（出现两次）{filter} {globalLine} {rowLines} {maxLocked} {maxCancelled}',
  '你是华境S汽车用户研究专家，分析「{dimensionLabel}」维度下不同取值的订单状态分布差异。
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
如果两者差异显著（差值超过10%），分析背后的用户心理或决策逻辑。如果差异不显著，说明该维度对转化影响有限的可能原因。'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_name = EXCLUDED.prompt_name,
      system_hint = EXCLUDED.system_hint,
      updated_at  = now();

-- 洞察字段配置（单独一行存 JSON）
INSERT INTO ai_prompts (prompt_key, prompt_name, system_hint, user_prompt)
VALUES (
  'insights_fields',
  '核心洞察分析字段',
  '控制哪些字段参与 AI 核心洞察分析。格式为 JSON 数组，每项包含 key/label/enabled。',
  '[
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
    {"key":"hobbies","label":"日常爱好","enabled":true,"type":"multi"}
  ]'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET user_prompt = EXCLUDED.user_prompt,
      system_hint = EXCLUDED.system_hint,
      updated_at  = now();
