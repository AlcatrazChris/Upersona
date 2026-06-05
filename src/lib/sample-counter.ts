/**
 * 统一样本计数模块
 *
 * 规则：
 * - 空白值（''、null、undefined、'(跳过)'）不计入样本数和百分比分母
 * - 单选题：分母 = 有非空值的用户数
 * - 多选题：分母 = 所有有效提及量之和
 */

/** 判断值是否有效（非空、非跳过） */
export function isValidValue(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== '' && s !== '(跳过)';
}

export interface CountResult {
  /** 标签 → 出现次数 */
  counter: Record<string, number>;
  /** 有非空值的用户数（单选题分母） */
  validUserCount: number;
  /** 所有有效提及总数（多选题分母） */
  multiSelectDenom: number;
  /** 原始用户总数（含空白，供参考） */
  totalUserCount: number;
}

/**
 * 统计一个维度的标签分布。
 * 所有 API 路由都应使用此函数替代各自的内联计数逻辑。
 */
export function countDimension(
  users: Record<string, unknown>[],
  dimKey: string,
  isMultiSelect: boolean
): CountResult {
  const counter: Record<string, number> = {};
  let validUserCount = 0;
  let multiSelectDenom = 0;

  for (const user of users) {
    const raw = user[dimKey];

    if (isMultiSelect && Array.isArray(raw)) {
      let hasValid = false;
      for (const v of raw as string[]) {
        if (isValidValue(v)) {
          const trimmed = String(v).trim();
          counter[trimmed] = (counter[trimmed] || 0) + 1;
          multiSelectDenom++;
          hasValid = true;
        }
      }
      if (hasValid) validUserCount++;
    } else {
      const v = String(raw ?? '').trim();
      if (isValidValue(v)) {
        counter[v] = (counter[v] || 0) + 1;
        validUserCount++;
      }
    }
  }

  return { counter, validUserCount, multiSelectDenom, totalUserCount: users.length };
}

/** 用正确的分母计算百分比 */
export function calcPercentage(
  count: number,
  result: CountResult,
  isMultiSelect: boolean
): number {
  const denom = isMultiSelect ? result.multiSelectDenom : result.validUserCount;
  return denom > 0 ? parseFloat((count / denom * 100).toFixed(1)) : 0;
}

/** 对标签列表排序：有序维度按 orderedValues，无序按频率降序 */
export function sortLabels(
  labels: string[],
  counter: Record<string, number>,
  isOrdered: boolean,
  orderedValues?: string[]
): string[] {
  const sorted = [...labels];
  if (isOrdered && orderedValues) {
    const orderMap = Object.fromEntries(orderedValues.map((v, i) => [v, i]));
    sorted.sort((a, b) => (orderMap[a] ?? 999) - (orderMap[b] ?? 999));
  } else {
    sorted.sort((a, b) => (counter[b] || 0) - (counter[a] || 0));
  }
  return sorted;
}
