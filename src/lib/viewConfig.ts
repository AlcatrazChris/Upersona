/**
 * viewConfig — per-dataset view configuration
 * Stores the mapping of which fields drive status, geography, persona display,
 * and AI insight prompts.  Auto-detected from dataset structure on first use.
 */

import type { Dataset } from '@/types/dataSchema';

// ── Status groups ─────────────────────────────────────────────

export interface StatusGroup {
  key:    string;
  label:  string;
  values: string[];   // raw field values belonging to this group
  color:  string;     // tailwind text + bg class pair, e.g. 'emerald'
  intent: 'strong' | 'weak' | 'neutral';
}

const STRONG_KW = ['锁单', '提车', '已购', '成交', '购买', '定金', '已定'];
const WEAK_KW   = ['退单', '取消', '放弃', '退', '失效', '无效'];

export const GROUP_COLORS: Record<StatusGroup['intent'], string> = {
  strong:  'emerald',
  neutral: 'blue',
  weak:    'red',
};

export function buildDefaultStatusGroups(values: string[]): StatusGroup[] {
  const strong  = values.filter(v => STRONG_KW.some(k => v.includes(k)));
  const weak    = values.filter(v => WEAK_KW.some(k => v.includes(k)));
  const neutral = values.filter(v => !strong.includes(v) && !weak.includes(v));
  const groups: StatusGroup[] = [];
  if (strong.length)  groups.push({ key: 'strong',  label: strong.join('/'),  values: strong,  color: 'emerald', intent: 'strong'  });
  if (neutral.length) groups.push({ key: 'neutral', label: neutral.join('/'), values: neutral, color: 'blue',    intent: 'neutral' });
  if (weak.length)    groups.push({ key: 'weak',    label: weak.join('/'),    values: weak,    color: 'red',     intent: 'weak'    });
  return groups;
}

// ── View config ───────────────────────────────────────────────

export interface ViewConfig {
  statusFieldKey?:    string;
  statusGroups?:      StatusGroup[];
  geoRegionKey?:      string;
  geoProvinceKey?:    string;
  geoCityKey?:        string;
  personaFieldKeys?:  string[];
  insightPrompt?:     string;
  insightResults?:    Record<string, string>; // context-hash → AI result
}

// ── Default insight prompt ────────────────────────────────────

export const DEFAULT_INSIGHT_PROMPT = `你是专业的用户研究分析师。请基于以下调研数据，为当前筛选人群生成核心用户画像分析。

分析要求：
1. 识别 1-2 个具有代表性的用户群体
2. 每个群体给出简洁的标签（格式：职业/特征·行为特点）
3. 从以下维度分析：人群基本信息、人群兴趣点、消费习惯预测
4. 引用具体数据（百分比、与全量对比差值 ±X%）

输出格式（严格遵守，不要输出其他内容）：
人群A
[简洁标题]
• 人群基本信息：...（含具体比例和与全量差异）
• 人群兴趣点：...（含具体比例）
• 消费习惯预测：...（含决策因素和行为预测）

人群B（如有）
[标题]
• 人群基本信息：...
• 人群兴趣点：...
• 消费习惯预测：...`;

// ── Auto-detection ────────────────────────────────────────────

export function autoDetectViewConfig(dataset: Dataset): ViewConfig {
  const config: ViewConfig = {};

  // Status field
  const statusKw = ['状态', '意向', '订单', '阶段', 'status'];
  const statusField = dataset.fields.find(f =>
    f.type === 'single_choice' && statusKw.some(kw => f.name.toLowerCase().includes(kw))
  );
  if (statusField) {
    config.statusFieldKey = statusField.key;
    config.statusGroups   = buildDefaultStatusGroups(statusField.options ?? []);
  }

  // Geo fields (prefer derived fields)
  const regionField = dataset.fields.find(f => f.name.includes('大区'));
  if (regionField) config.geoRegionKey = regionField.key;

  const provinceField = dataset.fields.find(f =>
    f.name === '省份' || f.name.includes('所在省') || f.name === '省/直辖市'
  );
  if (provinceField) config.geoProvinceKey = provinceField.key;

  const cityField = dataset.fields.find(f =>
    f.name === '城市' || f.name.includes('所在城市') || f.name === '所在城市'
  );
  if (cityField) config.geoCityKey = cityField.key;

  // Persona fields — all chartable types, not geo/status
  // Note: type detector already ensures single_choice/multi_choice have reasonable cardinality,
  // so we simply exclude 'text' fields and the special-purpose geo/status fields.
  const exclude = new Set(
    [config.statusFieldKey, config.geoRegionKey, config.geoProvinceKey, config.geoCityKey]
      .filter(Boolean) as string[]
  );
  config.personaFieldKeys = dataset.fields
    .filter(f => f.type !== 'text' && !exclude.has(f.key))
    .map(f => f.key);

  config.insightPrompt = DEFAULT_INSIGHT_PROMPT;
  return config;
}

// ── Context building for AI ───────────────────────────────────

import { aggregateField } from '@/lib/dataAggregator';

export function buildInsightContext(
  dataset: Dataset,
  filteredRecords: Record<string, unknown>[],
  personaFieldKeys: string[],
  label: string,
): string {
  const n = filteredRecords.length;
  const N = dataset.records.length;
  let ctx = `数据集：${dataset.name}\n`;
  ctx += `分析范围：${label}\n`;
  ctx += `样本量：${n}（全量 ${N}）\n\n`;

  for (const key of personaFieldKeys) {
    const field = dataset.fields.find(f => f.key === key);
    if (!field) continue;

    const filtData = aggregateField(filteredRecords, field);
    const fullData = aggregateField(dataset.records, field);
    const fullMap  = new Map(fullData.map(d => [d.label, d.percentage]));

    const validN = filtData.reduce((s, d) => s + d.count, 0);
    if (validN === 0) continue;

    ctx += `【${field.name}】（n=${validN}）\n`;
    for (const item of filtData.slice(0, 8)) {
      const fullPct = fullMap.get(item.label) ?? 0;
      const delta   = item.percentage - fullPct;
      const sign    = delta >= 0 ? '+' : '';
      ctx += `  ${item.label}: ${item.percentage.toFixed(1)}%（全量${sign}${delta.toFixed(1)}%）\n`;
    }
    ctx += '\n';
  }
  return ctx;
}
