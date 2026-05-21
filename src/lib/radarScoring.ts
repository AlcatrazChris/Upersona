// 雷达图评分计算逻辑（Server + Client 均可用）
import type { OrderStatus } from '@/types';

export const INCOME_SCORES: Record<string, number> = {
  '15万以下':10, '15-19万':25, '20-24万':40, '24-29万':55,
  '30-39万':70, '40-49万':85, '50万以上':100,
};
export const EDUCATION_SCORES: Record<string, number> = {
  '高中/中专及以下':20, '大专':40, '本科':65, '硕士':85, '博士':100,
};
export const FAMILY_SCORES: Record<string, number> = {
  '单身':10, '两口之家':30, '三口之家':60, '四口之家':80,
  '五口之家':90, '六口及以上':100,
};
export const OCCUPATION_SCORES: Record<string, number> = {
  '管理层':100, '专业人士':85, '公职':80, '白领':65, '个体户':60,
  '自由职业':50, '自媒体':45, '服务业':30, '蓝领':25, '其他':15,
};

type UserRow = {
  annual_income: string; education: string;
  family_structure: string; occupation_category: string;
  is_upgrade: string; order_status: string;
};

export function calcRadarScores(users: UserRow[]) {
  if (users.length === 0) return { income:0, education:0, family:0, occupation:0, upgrade:0, count:0 };

  let incomeSum = 0, eduSum = 0, famSum = 0, occSum = 0, upgradeCount = 0;
  for (const u of users) {
    incomeSum     += INCOME_SCORES[u.annual_income] ?? 40;
    eduSum        += EDUCATION_SCORES[u.education] ?? 40;
    famSum        += FAMILY_SCORES[u.family_structure] ?? 40;
    occSum        += OCCUPATION_SCORES[u.occupation_category] ?? 40;
    if (u.is_upgrade === '是') upgradeCount++;
  }
  const n = users.length;
  return {
    income:     parseFloat((incomeSum / n).toFixed(1)),
    education:  parseFloat((eduSum / n).toFixed(1)),
    family:     parseFloat((famSum / n).toFixed(1)),
    occupation: parseFloat((occSum / n).toFixed(1)),
    upgrade:    parseFloat((upgradeCount / n * 100).toFixed(1)),
    count: n,
  };
}

export const RADAR_DIMENSION_META = [
  { key: 'income',     label: '收入水平', unit: 'pts' },
  { key: 'education',  label: '学历水平', unit: 'pts' },
  { key: 'family',     label: '家庭规模', unit: 'pts' },
  { key: 'occupation', label: '职业评分', unit: 'pts' },
  { key: 'upgrade',    label: '换购意愿', unit: '%'   },
] as const;
