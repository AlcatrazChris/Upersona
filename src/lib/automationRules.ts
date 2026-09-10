import type { Dataset, Field } from '@/types/dataSchema';
import { detectSchema } from '@/lib/schemaDetector';
import { normalizeHuajingSurvey } from '@/lib/huajingSurveyNormalizer';
import { normalizeIndustryFields } from '@/lib/industryNormalizer';
import { applyCityTierEnrichment, applyRegionEnrichment, detectEnrichable } from '@/lib/fieldEnricher';
import { classifyPreviousVehicle } from '@/lib/vehicleClassifier';
import { normalizeSurveyFields } from '@/lib/surveyNormalizer';

export type CleaningOperation = 'builtin' | 'replace' | 'clear' | 'set_default' | 'rename_field' | 'delete_field' | 'delimiter';

export interface CleaningRule {
  id: string;
  name: string;
  enabled: boolean;
  operation: CleaningOperation;
  field: string;
  match: string;
  replacement: string;
  useRegex: boolean;
}

export interface CleaningTemplate {
  id: string;
  name: string;
  enabled: boolean;
  rules: CleaningRule[];
}

export interface AIDerivedRule {
  id: string;
  name: string;
  enabled: boolean;
  sourceField: string;
  targetField: string;
  prompt: string;
}

export interface AIOrderingRule {
  id: string;
  name: string;
  enabled: boolean;
  field: string;
  prompt: string;
}

export interface AutomationSettings {
  cleaningEnabled: boolean;
  aiDerivedEnabled: boolean;
  aiOrderingEnabled: boolean;
  selectedCleaningTemplateId: string;
  cleaningTemplates: CleaningTemplate[];
  aiDerivedRules: AIDerivedRule[];
  aiOrderingRules: AIOrderingRule[];
}

const skipRule = (id: string): CleaningRule => ({
  id,
  name: '清除跳过值',
  enabled: true,
  operation: 'clear',
  field: '',
  match: '^\\s*[（(]?跳过[）)]?\\s*$',
  replacement: '',
  useRegex: true,
});

const builtin = (id: string, name: string, key: string, description: string): CleaningRule => ({
  id, name, enabled: true, operation: 'builtin', field: '', match: key, replacement: description, useRegex: false,
});

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  cleaningEnabled: true,
  aiDerivedEnabled: false,
  aiOrderingEnabled: false,
  selectedCleaningTemplateId: 'xingguang',
  cleaningTemplates: [
    { id: 'xingguang', name: '星光L标准清洗', enabled: true, rules: [
      skipRule('xingguang-skip'),
      { id: 'xingguang-other', name: '清理“其他”补充说明', enabled: true, operation: 'replace', field: '', match: '\\s*[〔【〖][^〕】〗]*[〕】〗]\\s*', replacement: '', useRegex: true },
      { id: 'xingguang-status', name: '补齐订单状态', enabled: true, operation: 'set_default', field: '订单状态', match: '', replacement: '已提车', useRegex: false },
      builtin('xingguang-industry', '从事行业标准化', 'industry', '按现有行业关键词归并为标准行业'),
      builtin('xingguang-geo', '地区与城市级别', 'geo', '生成大区和城市级别字段'),
      builtin('xingguang-vehicle', '上一辆车识别', 'vehicle', '识别上一辆车品牌与旧车类型'),
    ] },
    { id: 'huajing', name: '华境S标准清洗', enabled: true, rules: [
      builtin('huajing-schema', '华境S问卷字段映射', 'huajing_schema', '按现有华境S标准53列重组问卷'),
      skipRule('huajing-skip'),
      builtin('huajing-industry', '从事行业标准化', 'industry', '合并行业及职业辅助字段后归类'),
      builtin('huajing-geo', '地区与城市级别', 'geo', '解析大区、省份、城市、区县与城市级别'),
      builtin('huajing-vehicle', '上一辆车识别', 'vehicle', '识别上一辆车品牌与旧车类型'),
    ] },
  ],
  aiDerivedRules: [],
  aiOrderingRules: [],
};

function matcher(rule: CleaningRule) {
  if (!rule.match) return null;
  try {
    return rule.useRegex ? new RegExp(rule.match, 'g') : null;
  } catch {
    return null;
  }
}

export function applyCleaningTemplate(dataset: Dataset, template?: CleaningTemplate): Dataset {
  if (!template?.enabled) return dataset;
  let records = dataset.records.map(record => ({ ...record }));
  if (template.rules.some(rule => rule.enabled && rule.operation === 'builtin' && rule.match === 'huajing_schema')) {
    records = normalizeHuajingSurvey(records);
  }
  records = normalizeSurveyFields(records);

  for (const rule of template.rules.filter(item => item.enabled)) {
    if (rule.operation === 'builtin') {
      if (rule.match === 'huajing_schema') records = normalizeHuajingSurvey(records);
      if (rule.match === 'industry') records = normalizeIndustryFields(records);
      if (rule.match === 'vehicle') {
        const key = Object.keys(records[0] ?? {}).find(item => item === '上一辆车' || item.includes('上一辆车类别'));
        if (key) records = records.map(record => { const result = classifyPreviousVehicle(record[key]); return { ...record, 上一辆车品牌: result.brand, 旧车类型: result.type }; });
      }
      if (rule.match === 'geo') {
        let current = { ...dataset, records, fields: detectSchema(records), rowCount: records.length };
        for (const enrich of detectEnrichable(current).filter(item => item.enrichType !== 'occupation')) {
          current = enrich.enrichType === 'region' ? applyRegionEnrichment(current, enrich) : applyCityTierEnrichment(current, enrich);
        }
        records = current.records;
      }
      continue;
    }
    const keys = rule.field ? [rule.field] : Object.keys(records[0] ?? {});
    if (rule.operation === 'rename_field' && rule.field && rule.replacement) {
      records = records.map(record => {
        if (!(rule.field in record)) return record;
        const next = { ...record, [rule.replacement]: record[rule.field] };
        delete next[rule.field];
        return next;
      });
      continue;
    }
    if (rule.operation === 'delete_field' && rule.field) {
      records = records.map(record => { const next = { ...record }; delete next[rule.field]; return next; });
      continue;
    }
    const regex = matcher(rule);
    records = records.map(record => {
      const next = { ...record };
      for (const key of keys) {
        const raw = String(next[key] ?? '');
        if (rule.operation === 'set_default') {
          if (!raw.trim()) next[key] = rule.replacement;
        } else if (rule.operation === 'delimiter') {
          if (rule.match) next[key] = raw.split(rule.match).join(rule.replacement || '┋');
        } else {
          const matched = regex ? (regex.lastIndex = 0, regex.test(raw)) : raw === rule.match;
          if (!matched) continue;
          next[key] = rule.operation === 'clear' ? '' : regex ? raw.replace(regex, rule.replacement) : rule.replacement;
        }
      }
      return next;
    });
  }

  return { ...dataset, records, fields: detectSchema(records), rowCount: records.length, updatedAt: new Date().toISOString() };
}

export function addDerivedField(dataset: Dataset, source: Field, target: string, prompt: string, mapping: Record<string, string>): Dataset {
  const key = `${source.key}__ai_${Date.now().toString(36)}`;
  const records = dataset.records.map(record => {
    const value = String(record[source.key] ?? '').trim();
    return { ...record, [key]: value ? mapping[value] ?? '其他' : '' };
  });
  const field = detectSchema(records).find(item => item.key === key);
  if (!field) return dataset;
  return { ...dataset, records, fields: [...dataset.fields, { ...field, name: target, derived: true, aiRule: { kind: 'derived', sourceFieldKey: source.key, prompt, mapping } }] };
}
