export interface AIOrderResult {
  isOrdered: boolean;
  orderedValues: string[];
}

function magnitude(value: string): number | undefined {
  const numbers = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!numbers?.length) return undefined;
  return numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
}

export function ensureDescendingOrder(values: string[]): string[] {
  const first = magnitude(values[0] ?? '');
  const last = magnitude(values.at(-1) ?? '');
  return first !== undefined && last !== undefined && first < last
    ? [...values].reverse()
    : values;
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

  const included = new Set(ordered);
  return {
    isOrdered: true,
    orderedValues: ensureDescendingOrder([
      ...ordered,
      ...values.filter(value => !included.has(value)),
    ]),
  };
}
