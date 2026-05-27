-- 单独运行此文件，在已有 ai_prompts 表的基础上补充新 prompt 数据
-- 安全：全部使用 ON CONFLICT DO UPDATE，可重复执行

INSERT INTO ai_prompts (prompt_key, prompt_name, system_hint, user_prompt)
VALUES (
  'status_insight',
  '状态对比维度洞察',
  '变量占位符：{dimensionLabel} {filter} {globalLine} {rowLines} {maxLockedLabel} {maxLockedPct} {maxCancelledLabel} {maxCancelledPct}',
  '你是华境S汽车用户研究专家，分析「{dimensionLabel}」维度下不同取值的订单状态分布差异。
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
如果两者差异显著（差值超过10%），分析背后的用户心理或决策逻辑。如果差异不显著，说明该维度对转化影响有限的可能原因。'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET user_prompt = EXCLUDED.user_prompt,
      prompt_name = EXCLUDED.prompt_name,
      system_hint = EXCLUDED.system_hint,
      updated_at  = now();

INSERT INTO ai_prompts (prompt_key, prompt_name, system_hint, user_prompt)
VALUES (
  'overview_insight',
  '状态对比概览洞察',
  '变量占位符：{summaryLines}（各维度 TOP 数据汇总，由系统自动生成）',
  '你是华境S汽车用户研究专家。以下是各维度用户的订单状态分布（列内百分比，即各订单状态组内该维度取值的占比）：

{summaryLines}

请用2-3段纯文本（不加Markdown格式）分析：
1. 哪些维度的锁单用户与退单用户差异最显著？核心差异是什么？
2. 整体来看，什么样的用户特征与锁单率更相关？
每段直接陈述，不加标题和编号。'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET user_prompt = EXCLUDED.user_prompt,
      prompt_name = EXCLUDED.prompt_name,
      system_hint = EXCLUDED.system_hint,
      updated_at  = now();

INSERT INTO ai_prompts (prompt_key, prompt_name, system_hint, user_prompt)
VALUES (
  'predict_intent',
  '用户意向预测',
  '变量占位符：{profileText}（用户画像字段列表，系统自动组装，含城市/年龄/职业/收入/消费观念等）',
  '你是华境S销售分析专家。基于用户画像，评估转化为锁单用户的概率（0-100分）。

{profileText}

严格按JSON返回，不输出其他内容：
{"score":数字,"keyFactors":["关键因素1","关键因素2","关键因素3"],"marketingAdvice":"针对性营销建议（25字内）"}'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET user_prompt = EXCLUDED.user_prompt,
      prompt_name = EXCLUDED.prompt_name,
      system_hint = EXCLUDED.system_hint,
      updated_at  = now();
