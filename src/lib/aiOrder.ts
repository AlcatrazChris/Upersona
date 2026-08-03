export interface AIOrderResult {
  isOrdered: boolean;
  orderedValues: string[];
}

export const ORDERING_SYSTEM_PROMPT = '你是调查问卷选项排序专家。必须先比较全部选项的真实等级，再从高到低输出。严格输出 JSON，不解释、不改写选项。';

export const ORDERING_RULES = `
【唯一方向】列表顶部必须是最高/最大/最强，底部必须是最低/最小/最弱。禁止高低交错。
【数值区间】先把每个选项理解为数轴区间，再按区间位置整体降序。>、≥、以上是最高端；<、≤、以下是最低端。最高端后面必须接次高区间，绝不能接最低端。
【单位】统一万、千、k、w、%、年、月等单位，正确处理负数、小数、不到、超过、以内、以外。
【固定语义】学历：博士 > 硕士 > 大学本科 > 大专 > 高中/中专/职校/技校 > 初中及以下。家庭同住人数中“自己独居”等于1人。
【生命周期】孩子年龄：已工作已婚 > 已工作未婚 > 18岁及以上在学 > 12-18岁 > 6-12岁 > 3-6岁 > 1-3岁。
【无序字段】品牌、地区、职业、性别、颜色、渠道等没有客观高低的字段返回 isOrdered=false。
【兜底项】其他、未知、不清楚、不适用放在所有有效等级之后。

正确示例（均为列表顶部到列表底部）：
- 年龄段：>60, 56~60, 51~55, 46~50, 41~45, 36~40, 31~35, 26~30, ≤25
- 工作年限：20年以上, 15~20年, 10~15年, 6~10年, 4~6年, 2~4年, 0~2年, 其他
- 家庭年收入：>50万元, 45~50万元, 40~45万元, ..., 15~20万元, 10~15万元, <10万元
- 家庭同住人数：7人, 6人, 5人, 4人, 3人, 2人, 自己独居

输出前必须检查：任意相邻两项都满足前项 >= 后项；orderedIndices 完整包含所有输入序号且无重复。不要返回选项文本。`;

export function buildAIOrderPrompt(fieldName: string, values: string[]): string {
  return `${ORDERING_RULES}

字段名：${fieldName}
原始选项（数组下标从0开始）：${JSON.stringify(values)}

若存在客观顺序，返回：{"isOrdered":true,"orderedIndices":[从最高到最低的完整下标]}
若不存在客观顺序，返回：{"isOrdered":false,"orderedIndices":[]}
只返回 JSON。`;
}

export function resolveAIOrder(raw: string, values: string[]): AIOrderResult {
  const json = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: {
    isOrdered?: unknown;
    orderedIndices?: unknown;
    orderedValues?: unknown;
  };

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('AI 返回的排序结果不完整，请重试');
  }

  if (parsed.isOrdered !== true) return { isOrdered: false, orderedValues: [] };

  const ordered = Array.isArray(parsed.orderedIndices)
    ? parsed.orderedIndices
        .map(Number)
        .filter((index, position, all) =>
          Number.isInteger(index) && index >= 0 && index < values.length && all.indexOf(index) === position
        )
        .map(index => values[index])
    : Array.isArray(parsed.orderedValues)
      ? parsed.orderedValues.map(String).filter((value, index, all) =>
          values.includes(value) && all.indexOf(value) === index
        )
      : [];

  if (ordered.length !== values.length) {
    throw new Error('AI 返回的排序结果缺少选项，请重试');
  }
  return {
    isOrdered: true,
    orderedValues: ordered,
  };
}
