/**
 * viewConfig — per-dataset view configuration
 * Stores the mapping of which fields drive status, geography, persona display,
 * and AI insight prompts.  Auto-detected from dataset structure on first use.
 */

import type { Dataset } from '@/types/dataSchema';
import type { PersonaChartSpec, PersonaSemanticRole } from '@/lib/personaTemplate';
import { detectTimeField, type DateBlock } from '@/lib/timeStatus';

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
  dateBlocks?:        DateBlock[];
  geoRegionKey?:      string;
  geoProvinceKey?:    string;
  geoCityKey?:        string;
  personaFieldKeys?:  string[];
  personaRoles?:      Record<string, PersonaSemanticRole>;
  personaRoleReasons?: Record<string, string>;
  personaCharts?:     Record<string, PersonaChartSpec>;
  insightPrompt?:     string;
  /** per-view custom AI prompts: key = view id ('regional' | 'status' | 'rfeature') */
  viewPrompts?:       Record<string, string>;
  insightResults?:    Record<string, string>;
  clusterResults?:    Record<string, ClusterInsightResult>;
}

// ── Cluster insight types ─────────────────────────────────────

export interface ClusterDimension {
  top_value: string;
  est_pct:   number;
}

/** AI explicitly picks which values of a field to display (resolved to real computed %) */
export interface DataPoint {
  field:   string;    // exact field name from dataset
  values:  string[];  // specific values AI selects to support the conclusion
  label?:  string;    // optional display label override for field name
}

export interface InsightSection {
  title:  string;
  text:   string;
  data?:  DataPoint;  // optional inline supporting data (mini bars below text)
}

export interface ClusterSegment {
  name:              string;
  subtitle?:         string;
  estimated_pct?:    number;
  pct_estimate?:     number;
  keywords?:         string[];
  who_intro?:        string;             // left col header: 1-sentence identity description
  core_insight:      string;
  // new schema (v4+)
  who_data?:         DataPoint[];        // left col: AI-selected key demographic values
  insight_sections?: InsightSection[];   // center table; [2].data = history inline bars
  preference_intro?: string;
  preference_detail?: string;            // descriptive analysis of purchase drivers/decision factors
  preference_data?:  DataPoint[];        // bottom: purchase preference mini charts
  /** Cluster-specific field distributions (server-injected for V2 results).
   *  Used by resolveDataPoint to show cluster-level percentages instead of global averages.
   *  delta is stripped before storage — only clean pct values are kept here. */
  clusterDist?: Array<{
    fieldName: string;
    topValues: Array<{ value: string; pct: number }>;
  }>;
  // legacy
  key_traits?:         string[];
  purchase_motivation?: string;
  dimensions?:          Record<string, ClusterDimension>;
  chart_fields?:        string[];
  preference_fields?:   string[];
}

export interface ClusterInsightResult {
  segments:    ClusterSegment[];
  overview?:   string;
  generatedAt: string;
}

// ── Default insight prompt ────────────────────────────────────

export const DEFAULT_INSIGHT_PROMPT = `你是资深汽车行业用户研究分析师，擅长从调研数据中洞察购车用户的行为特征与消费心理。请基于以下数据，为当前筛选人群生成核心用户画像报告。

**分析维度（按优先级）：**
1. **人群画像**：年龄/性别/城市线级/职业/收入等基础特征，标注与全量的显著差异（±X%）
2. **购车决策**：核心购买动机（空间/动力/智能/品牌/价格等）、决策周期、信息获取渠道
3. **竞争态势**：主要竞品考虑集合，本品牌/车型的核心胜出点与潜在流失风险
4. **生活方式与价值观**：家庭结构、出行场景、兴趣偏好，折射出的消费价值取向
5. **关键洞察**：1-2条最值得关注的结论，直接用于产品/营销决策

**输出格式（严格遵守）：**
人群A
[简洁群体标签，例如：进取务实的新中产·家庭首购]
• 人群画像：...（核心特征 + 与全量差异）
• 购车决策：...（动机、渠道、周期）
• 竞品对比：...（考虑过哪些车，为何选/不选本品牌）
• 生活方式：...（场景、价值观）
• 关键洞察：...

人群B（如有）
[标签]
• 人群画像：...
• 购车决策：...
• 竞品对比：...
• 生活方式：...
• 关键洞察：...

**注意：引用真实数据百分比，不得编造；与全量差异用 ±X% 标注。**`;

// ── Auto-detection ────────────────────────────────────────────

function fieldValues(dataset: Dataset, fieldKey: string): string[] {
  return [...new Set(dataset.records
    .map(record => String(record[fieldKey] ?? '').trim())
    .filter(Boolean))];
}

function explicitOrderStatusField(dataset: Dataset) {
  return dataset.fields.find(field =>
    field.name.trim() === '订单状态' || field.key.trim() === '订单状态'
  );
}

/** Prevent a blank 订单状态 column from falling through to unrelated fields such as 工作生活状态. */
export function normalizeViewConfig(dataset: Dataset, config: ViewConfig): ViewConfig {
  const explicit = explicitOrderStatusField(dataset);
  if (!explicit) return config;
  const values = fieldValues(dataset, explicit.key);
  if (!values.length) return { ...config, statusFieldKey: undefined, statusGroups: [] };
  return {
    ...config,
    statusFieldKey: explicit.key,
    statusGroups: buildDefaultStatusGroups(values),
  };
}

export function autoDetectViewConfig(dataset: Dataset): ViewConfig {
  const config: ViewConfig = {};
  const timeField = detectTimeField(dataset);

  // Status field
  const statusKw = ['状态', '意向', '订单', '阶段', 'status'];
  const explicitStatusField = explicitOrderStatusField(dataset);
  const statusField = explicitStatusField
    ? (fieldValues(dataset, explicitStatusField.key).length ? explicitStatusField : undefined)
    : dataset.fields.find(f =>
        f.type === 'single_choice' && statusKw.some(kw => f.name.toLowerCase().includes(kw))
      );
  if (statusField) {
    config.statusFieldKey = statusField.key;
    config.statusGroups   = buildDefaultStatusGroups(statusField.options ?? fieldValues(dataset, statusField.key));
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
    [config.statusFieldKey, config.geoRegionKey, config.geoProvinceKey, config.geoCityKey, timeField?.key]
      .filter(Boolean) as string[]
  );
  config.personaFieldKeys = dataset.fields
    .filter(f => f.type !== 'text' && !exclude.has(f.key))
    .map(f => f.key);

  // intentionally NOT setting insightPrompt here — only the user explicitly saves it,
  // so autoDetect never pollutes the cloud with a default that overwrites custom prompts.
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
