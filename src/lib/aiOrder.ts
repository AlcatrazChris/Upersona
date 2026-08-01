export interface AIOrderResult {
  isOrdered: boolean;
  orderedValues: string[];
}

export const ORDERING_RULES = `
排序必须从大到小、从高到低、从强到弱。
数字边界要按数学含义判断：>、≥、以上表示下界，<、≤、以下表示上界；区间按上下界比较，不能只提取数字后整体反转。
例如“≥50万”高于“30-50万”，“<10万”低于“10-20万”；“从不/偶尔/经常/总是”按语义强度排序。
“其他、未知、不清楚、不适用”放在有序选项之后。
orderedIndices 必须完整包含所有输入序号且不得重复；不要改写选项文本。`;

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
