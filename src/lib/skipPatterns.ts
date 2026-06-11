/**
 * skipPatterns
 *
 * 跳过值识别工具：匹配规则
 *  1. 精确匹配 SKIP_EXACT 表中的字符串（trim 之后）
 *  2. 去掉外层括号后再次精确匹配：
 *     支持 ( ) （ ） [ ] 【 】 < > 《 》 — 覆盖 (跳过) / （N/A）等形式
 */

/** 精确匹配集合（trim 后比较） */
export const SKIP_EXACT = new Set<string>([
  // Chinese explicit skips
  '跳过', '已跳过', '跳过此题', '跳', '跳答', '免答',
  // Chinese non-response
  '不适用', '未作答', '未回答', '未填写', '未填', '未填答',
  '本题跳过', '此题跳过',
  // Common symbols used as "no answer"
  'N/A', 'n/a', 'NA', 'na', 'n.a', 'N.A', 'N.A.',
  '-', '—', '——', '--',
  // Empty-ish markers
  '(空)', '（空）', '空', '无效', '无效答案',
  // Slash — often used in paper-based surveys
  '/',
]);

// 只剥一层括号（避免把正常带括号的内容误识别）
const BRACKET_RE = /^[\s（(\[【<《]+(.+?)[\s）)\]】>》]+$/;

/**
 * 判断一个字段值是否属于"跳过类答案"。
 *
 * 先精确匹配，再尝试剥去外层括号后精确匹配。
 * 输入会先做 `.trim()`，传入时不必提前处理。
 */
export function isSkipValue(raw: unknown): boolean {
  if (raw == null) return false;
  const v = String(raw).trim();
  if (!v) return false;

  // 1. 精确匹配
  if (SKIP_EXACT.has(v)) return true;

  // 2. 去括号后匹配，只剥一层
  const m = BRACKET_RE.exec(v);
  if (m) {
    const inner = m[1].trim();
    if (SKIP_EXACT.has(inner)) return true;
  }

  return false;
}
