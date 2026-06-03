/**
 * 数据清洗模块
 *
 * 两阶段清洗：
 * 1. 规则映射（本地，即时，无费用）
 * 2. DeepSeek API 批量兜底（仅处理规则无法识别的值）
 *
 * 使用方式：在 upload/route.ts 中对每行数据调用 cleanRow()，
 * 最后统一调用 batchCleanUnresolved() 处理 AI 待定值。
 */

// ── 标准值集合 ──────────────────────────────────────────────────

export const STD_AGE_GROUP      = ['30岁以下','30-34岁','35-39岁','40-44岁','45-49岁','50岁以上'] as const;
export const STD_EDUCATION      = ['高中/中专及以下','大专','本科','硕士','博士'] as const;
export const STD_FAMILY         = ['单身','两口之家','三口之家','四口之家','五口之家','六口及以上'] as const;
export const STD_INCOME         = ['15万以下','15-19万','20-24万','24-29万','30-39万','40-49万','50万以上'] as const;
export const STD_IS_UPGRADE     = ['是','否'] as const;
export const STD_ORDER_STATUS   = ['未锁单','已锁单','订单完成','退单'] as const;

type AgeGroup    = typeof STD_AGE_GROUP[number];
type Education   = typeof STD_EDUCATION[number];
type Family      = typeof STD_FAMILY[number];
type Income      = typeof STD_INCOME[number];
type IsUpgrade   = typeof STD_IS_UPGRADE[number];
type OrderStatus = typeof STD_ORDER_STATUS[number];

// ── 年龄段 ──────────────────────────────────────────────────────

const AGE_ALIASES: Record<string, AgeGroup> = {
  '30以下': '30岁以下', '30岁以下': '30岁以下', '30-': '30岁以下',
  '30-34': '30-34岁', '35-39': '35-39岁', '40-44': '40-44岁',
  '45-49': '45-49岁', '50以上': '50岁以上', '50岁以上': '50岁以上',
  '50+': '50岁以上',
};

export function cleanAgeGroup(raw: string): { value: string; changed: boolean } {
  const s = raw.trim();
  if ((STD_AGE_GROUP as readonly string[]).includes(s)) return { value: s, changed: false };
  if (AGE_ALIASES[s]) return { value: AGE_ALIASES[s], changed: true };
  // 纯数字/带岁
  const num = parseInt(s.replace(/[^\d]/g, ''));
  if (!isNaN(num) && num > 0 && num < 120) {
    let mapped: AgeGroup;
    if (num < 30)       mapped = '30岁以下';
    else if (num < 35)  mapped = '30-34岁';
    else if (num < 40)  mapped = '35-39岁';
    else if (num < 45)  mapped = '40-44岁';
    else if (num < 50)  mapped = '45-49岁';
    else                mapped = '50岁以上';
    return { value: mapped, changed: true };
  }
  return { value: s, changed: false }; // 无法识别，待 AI
}

// ── 学历 ────────────────────────────────────────────────────────

const EDU_ALIASES: Record<string, Education> = {
  '高中': '高中/中专及以下', '中专': '高中/中专及以下', '职高': '高中/中专及以下',
  '职业高中': '高中/中专及以下', '技校': '高中/中专及以下', '初中': '高中/中专及以下',
  '小学': '高中/中专及以下', '高中及以下': '高中/中专及以下', '高中/中专': '高中/中专及以下',
  '中职': '高中/中专及以下', '专科': '大专', '大学专科': '大专', '大专学历': '大专',
  '大学': '本科', '大学本科': '本科', '本科学历': '本科', '大学本科学历': '本科',
  '学士': '本科',
  '研究生': '硕士', '硕士研究生': '硕士', '硕士学位': '硕士', 'MBA': '硕士',
  '博士研究生': '博士', '博士学位': '博士',
};

export function cleanEducation(raw: string): { value: string; changed: boolean } {
  const s = raw.trim();
  if ((STD_EDUCATION as readonly string[]).includes(s)) return { value: s, changed: false };
  if (EDU_ALIASES[s]) return { value: EDU_ALIASES[s], changed: true };
  const lower = s.toLowerCase();
  if (lower.includes('博士')) return { value: '博士', changed: true };
  if (lower.includes('硕士') || lower.includes('研究生') || lower.includes('mba')) return { value: '硕士', changed: true };
  if (lower.includes('本科') || lower.includes('大学')) return { value: '本科', changed: true };
  if (lower.includes('大专') || lower.includes('专科')) return { value: '大专', changed: true };
  if (lower.includes('高中') || lower.includes('中专') || lower.includes('职高')) return { value: '高中/中专及以下', changed: true };
  return { value: s, changed: false };
}

// ── 家庭结构 ─────────────────────────────────────────────────────

const FAMILY_ALIASES: Record<string, Family> = {
  '单身': '单身', '一人': '单身', '独居': '单身',
  '两口': '两口之家', '2口': '两口之家', '夫妻': '两口之家', '夫妻两人': '两口之家', '夫妇两人': '两口之家',
  '三口': '三口之家', '3口': '三口之家', '一家三口': '三口之家', '3口之家': '三口之家', '三口家庭': '三口之家',
  '四口': '四口之家', '4口': '四口之家', '一家四口': '四口之家', '4口之家': '四口之家',
  '五口': '五口之家', '5口': '五口之家', '一家五口': '五口之家', '5口之家': '五口之家',
  '六口': '六口及以上', '6口': '六口及以上', '七口': '六口及以上', '8口': '六口及以上',
};

export function cleanFamilyStructure(raw: string): { value: string; changed: boolean } {
  const s = raw.trim();
  if ((STD_FAMILY as readonly string[]).includes(s)) return { value: s, changed: false };
  if (FAMILY_ALIASES[s]) return { value: FAMILY_ALIASES[s], changed: true };
  // 匹配数字
  const num = parseInt(s.replace(/[^\d]/g, ''));
  if (!isNaN(num)) {
    const map: Record<number, Family> = { 1: '单身', 2: '两口之家', 3: '三口之家', 4: '四口之家', 5: '五口之家' };
    return { value: num >= 6 ? '六口及以上' : (map[num] ?? s), changed: true };
  }
  return { value: s, changed: false };
}

// ── 家庭年收入 ───────────────────────────────────────────────────

const INCOME_ALIASES: Record<string, Income> = {
  '15以下': '15万以下', '15万以下': '15万以下', '<15': '15万以下', '10万以下': '15万以下',
  '15-19': '15-19万', '15-20': '15-19万',
  '20-24': '20-24万', '20-25': '20-24万',
  '24-29': '24-29万', '25-29': '24-29万', '25-30': '24-29万',
  '30-39': '30-39万', '30-40': '30-39万',
  '40-49': '40-49万', '40-50': '40-49万',
  '50以上': '50万以上', '50万以上': '50万以上', '>50': '50万以上', '50+': '50万以上',
};

export function cleanAnnualIncome(raw: string): { value: string; changed: boolean } {
  const s = raw.trim();
  if ((STD_INCOME as readonly string[]).includes(s)) return { value: s, changed: false };
  if (INCOME_ALIASES[s]) return { value: INCOME_ALIASES[s], changed: true };
  // 纯数字（万元）
  const stripped = s.replace(/万.*|元.*/, '').replace(/[^\d.]/g, '');
  const val = parseFloat(stripped);
  if (!isNaN(val) && val > 0) {
    let mapped: Income;
    if (val < 15)       mapped = '15万以下';
    else if (val < 20)  mapped = '15-19万';
    else if (val < 24)  mapped = '20-24万';
    else if (val < 30)  mapped = '24-29万';
    else if (val < 40)  mapped = '30-39万';
    else if (val < 50)  mapped = '40-49万';
    else                mapped = '50万以上';
    return { value: mapped, changed: true };
  }
  return { value: s, changed: false };
}

// ── 是否增换购 ───────────────────────────────────────────────────

const UPGRADE_YES = new Set(['是','换购','增购','置换','升级','二手换','旧换新','以旧换新','车换车']);
const UPGRADE_NO  = new Set(['否','首购','首次购车','新车','初次购车','首次','第一辆']);

export function cleanIsUpgrade(raw: string): { value: string; changed: boolean } {
  const s = raw.trim();
  if (UPGRADE_YES.has(s)) return { value: '是', changed: s !== '是' };
  if (UPGRADE_NO.has(s))  return { value: '否', changed: s !== '否' };
  const lower = s.toLowerCase();
  if (lower.includes('换购') || lower.includes('置换') || lower.includes('增购')) return { value: '是', changed: true };
  if (lower.includes('首购') || lower.includes('首次')) return { value: '否', changed: true };
  return { value: s, changed: false };
}

// ── 订单状态 ─────────────────────────────────────────────────────

const ORDER_ALIASES: Record<string, OrderStatus> = {
  '未锁单': '未锁单', '意向': '未锁单', '潜在': '未锁单', '跟进中': '未锁单',
  '已锁单': '已锁单', '锁单': '已锁单', '订金': '已锁单', '定金': '已锁单',
  '订单完成': '订单完成', '提车': '订单完成', '已提': '订单完成', '完成': '订单完成',
  '退单': '退单', '已退': '退单', '取消': '退单', '退订': '退单',
};

export function cleanOrderStatus(raw: string): { value: string; changed: boolean } {
  const s = raw.trim();
  if ((STD_ORDER_STATUS as readonly string[]).includes(s)) return { value: s, changed: false };
  if (ORDER_ALIASES[s]) return { value: ORDER_ALIASES[s], changed: true };
  return { value: s, changed: false };
}

// ── 应用全部规则到一行 ───────────────────────────────────────────

export interface CleanResult {
  age_group:        { value: string; changed: boolean };
  education:        { value: string; changed: boolean };
  family_structure: { value: string; changed: boolean };
  annual_income:    { value: string; changed: boolean };
  is_upgrade:       { value: string; changed: boolean };
  order_status:     { value: string; changed: boolean };
}

/** 对空值直接透传，不做任何清洗（保持空白） */
function passthroughIfEmpty(raw: string, cleaner: (s: string) => { value: string; changed: boolean }) {
  if (!raw || raw.trim() === '') return { value: '', changed: false };
  return cleaner(raw);
}

export function cleanRow(raw: {
  age_group: string; education: string; family_structure: string;
  annual_income: string; is_upgrade: string; order_status: string;
}): CleanResult {
  return {
    age_group:        passthroughIfEmpty(raw.age_group,        cleanAgeGroup),
    education:        passthroughIfEmpty(raw.education,        cleanEducation),
    family_structure: passthroughIfEmpty(raw.family_structure, cleanFamilyStructure),
    annual_income:    passthroughIfEmpty(raw.annual_income,    cleanAnnualIncome),
    is_upgrade:       passthroughIfEmpty(raw.is_upgrade,       cleanIsUpgrade),
    order_status:     passthroughIfEmpty(raw.order_status,     cleanOrderStatus),
  };
}

// ── AI 批量兜底清洗（对规则无法识别的值） ───────────────────────

/**
 * 对无法用规则识别的值，批量调用 DeepSeek 进行智能映射。
 * 返回 { field:rawValue → standardValue } 的映射表。
 */
export async function batchCleanUnresolved(
  unresolved: { field: string; raw: string; options: string[] }[]
): Promise<Record<string, string>> {
  if (unresolved.length === 0) return {};

  const lines = unresolved.map((u, i) =>
    `${i + 1}. 字段=${u.field}，原始值="${u.raw}"，可选标准值=${JSON.stringify(u.options)}`
  ).join('\n');

  const prompt = `你是数据清洗专家。将以下原始字段值映射到对应的标准值。
每条给出字段名、原始值和可选标准值。请选择最接近的标准值。
如果原始值完全无法识别，返回空字符串""。

${lines}

严格按JSON返回（数组，与输入顺序一致），不输出其他内容：
[{"field":"字段名","raw":"原始值","standard":"选中的标准值"}]`;

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const text  = data.choices[0].message.content.trim();
    const start = text.indexOf('[');
    const end   = text.lastIndexOf(']');
    if (start === -1 || end === -1) return {};
    const arr = JSON.parse(text.slice(start, end + 1)) as { field: string; raw: string; standard: string }[];
    const result: Record<string, string> = {};
    for (const item of arr) {
      if (item.standard) result[`${item.field}::${item.raw}`] = item.standard;
    }
    return result;
  } catch {
    return {};
  }
}
