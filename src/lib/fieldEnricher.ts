/**
 * fieldEnricher
 *
 * Detects common field patterns (province/city, occupation) and derives new
 * categorical fields automatically.  Rule-based enrichments (region, city tier)
 * run client-side with no API call; occupation mapping uses the /api/enrich route.
 */

import type { Dataset, Field, FieldType } from '@/types/dataSchema';

// ── Province → Region ─────────────────────────────────────────

export const PROVINCE_REGION: Record<string, string> = {
  // 东北
  '黑龙江': '东北', '吉林': '东北', '辽宁': '东北', '内蒙古': '东北',
  // 华北
  '北京': '华北', '河北': '华北', '山西': '华北', '天津': '华北',
  // 华东
  '福建': '华东', '江苏': '华东', '上海': '华东', '浙江': '华东', '山东': '华东',
  // 华南
  '广东': '华南', '广西': '华南', '海南': '华南',
  // 西北
  '宁夏': '西北', '青海': '西北', '陕西': '西北', '新疆': '西北', '甘肃': '西北',
  // 西南
  '贵州': '西南', '四川': '西南', '云南': '西南', '重庆': '西南', '西藏': '西南',
  // 中南
  '安徽': '中南', '湖北': '中南', '湖南': '中南', '江西': '中南', '河南': '中南',
};

export const REGION_ORDER = ['华东', '华南', '华北', '中南', '西南', '西北', '东北'];

// ── City → Province (major cities) ───────────────────────────

const CITY_PROVINCE: Record<string, string> = {
  // 直辖市
  '北京': '北京', '上海': '上海', '天津': '天津', '重庆': '重庆',
  // 广东
  '广州': '广东', '深圳': '广东', '东莞': '广东', '佛山': '广东', '珠海': '广东',
  '惠州': '广东', '中山': '广东', '汕头': '广东', '江门': '广东', '湛江': '广东',
  '汕尾': '广东', '揭阳': '广东', '茂名': '广东', '肇庆': '广东', '梅州': '广东',
  // 浙江
  '杭州': '浙江', '宁波': '浙江', '温州': '浙江', '嘉兴': '浙江', '台州': '浙江',
  '绍兴': '浙江', '金华': '浙江', '舟山': '浙江', '湖州': '浙江', '衢州': '浙江',
  // 江苏
  '南京': '江苏', '苏州': '江苏', '无锡': '江苏', '南通': '江苏', '扬州': '江苏',
  '徐州': '江苏', '常州': '江苏', '镇江': '江苏', '泰州': '江苏', '盐城': '江苏',
  '淮安': '江苏', '连云港': '江苏', '宿迁': '江苏',
  // 四川
  '成都': '四川', '绵阳': '四川', '德阳': '四川', '南充': '四川', '宜宾': '四川',
  '自贡': '四川', '泸州': '四川', '达州': '四川', '乐山': '四川',
  // 湖北
  '武汉': '湖北', '宜昌': '湖北', '襄阳': '湖北', '黄石': '湖北', '荆州': '湖北',
  // 湖南
  '长沙': '湖南', '株洲': '湖南', '湘潭': '湖南', '岳阳': '湖南', '衡阳': '湖南',
  '常德': '湖南', '邵阳': '湖南',
  // 陕西
  '西安': '陕西', '咸阳': '陕西', '宝鸡': '陕西', '渭南': '陕西', '延安': '陕西',
  // 河南
  '郑州': '河南', '洛阳': '河南', '开封': '河南', '新乡': '河南', '南阳': '河南',
  '安阳': '河南', '焦作': '河南', '许昌': '河南',
  // 山东
  '济南': '山东', '青岛': '山东', '烟台': '山东', '临沂': '山东', '济宁': '山东',
  '潍坊': '山东', '淄博': '山东', '威海': '山东', '东营': '山东', '泰安': '山东',
  // 辽宁
  '沈阳': '辽宁', '大连': '辽宁', '鞍山': '辽宁', '抚顺': '辽宁', '锦州': '辽宁',
  // 黑龙江
  '哈尔滨': '黑龙江', '大庆': '黑龙江', '齐齐哈尔': '黑龙江', '牡丹江': '黑龙江',
  // 吉林
  '长春': '吉林', '吉林市': '吉林', '四平': '吉林',
  // 安徽
  '合肥': '安徽', '芜湖': '安徽', '马鞍山': '安徽', '淮南': '安徽', '蚌埠': '安徽',
  // 福建
  '福州': '福建', '厦门': '福建', '泉州': '福建', '漳州': '福建', '莆田': '福建',
  // 江西
  '南昌': '江西', '赣州': '江西', '景德镇': '江西', '九江': '江西',
  // 广西
  '南宁': '广西', '桂林': '广西', '柳州': '广西', '北海': '广西',
  // 云南
  '昆明': '云南', '曲靖': '云南', '丽江': '云南', '大理': '云南',
  // 贵州
  '贵阳': '贵州', '遵义': '贵州', '毕节': '贵州',
  // 新疆
  '乌鲁木齐': '新疆', '喀什': '新疆', '伊宁': '新疆',
  // 甘肃
  '兰州': '甘肃', '天水': '甘肃', '白银': '甘肃',
  // 内蒙古
  '呼和浩特': '内蒙古', '鄂尔多斯': '内蒙古', '赤峰': '内蒙古', '包头': '内蒙古',
  // 河北
  '石家庄': '河北', '保定': '河北', '唐山': '河北', '廊坊': '河北', '邯郸': '河北',
  '沧州': '河北', '邢台': '河北', '张家口': '河北', '承德': '河北',
  // 山西
  '太原': '山西', '大同': '山西', '运城': '山西', '临汾': '山西',
  // 宁夏
  '银川': '宁夏', '石嘴山': '宁夏',
  // 青海
  '西宁': '青海',
  // 海南
  '海口': '海南', '三亚': '海南', '三沙': '海南',
  // 西藏
  '拉萨': '西藏',
};

// ── City Tier ─────────────────────────────────────────────────

export const CITY_TIER: Record<string, string> = {
  // 一线城市
  '北京': '一线城市', '上海': '一线城市', '广州': '一线城市', '深圳': '一线城市',
  // 新一线城市（2023）
  '成都': '新一线城市', '重庆': '新一线城市', '杭州': '新一线城市', '武汉': '新一线城市',
  '西安': '新一线城市', '苏州': '新一线城市', '郑州': '新一线城市', '南京': '新一线城市',
  '天津': '新一线城市', '长沙': '新一线城市', '东莞': '新一线城市', '佛山': '新一线城市',
  '宁波': '新一线城市', '青岛': '新一线城市', '沈阳': '新一线城市',
  // 二线城市
  '昆明': '二线城市', '大连': '二线城市', '厦门': '二线城市', '合肥': '二线城市',
  '济南': '二线城市', '哈尔滨': '二线城市', '福州': '二线城市', '温州': '二线城市',
  '石家庄': '二线城市', '无锡': '二线城市', '长春': '二线城市', '南宁': '二线城市',
  '南昌': '二线城市', '贵阳': '二线城市', '太原': '二线城市', '乌鲁木齐': '二线城市',
  '兰州': '二线城市', '常州': '二线城市', '珠海': '二线城市', '烟台': '二线城市',
  '惠州': '二线城市', '洛阳': '二线城市', '唐山': '二线城市', '嘉兴': '二线城市',
  '泉州': '二线城市', '徐州': '二线城市', '绍兴': '二线城市', '台州': '二线城市',
  '南通': '二线城市', '扬州': '二线城市', '江门': '二线城市', '中山': '二线城市',
  '汕头': '二线城市', '廊坊': '二线城市', '临沂': '二线城市', '赣州': '二线城市',
  '海口': '二线城市', '三亚': '二线城市', '济宁': '二线城市', '芜湖': '二线城市',
  '银川': '二线城市', '桂林': '二线城市', '株洲': '二线城市', '湛江': '二线城市',
  '保定': '二线城市', '镇江': '二线城市', '潍坊': '二线城市', '淄博': '二线城市',
  '呼和浩特': '二线城市',
};

export const CITY_TIER_ORDER = ['一线城市', '新一线城市', '二线城市', '三线城市', '四线城市', '其他'];

// ── Occupation categories ─────────────────────────────────────

export const OCCUPATION_CATEGORIES = [
  '个体户/合伙人', '单位负责人', '医疗人员', '教育工作者', '工程技术人员',
  '法律人员', '财务审计人员', '金融从业者', '科研人员', '文化艺术人员',
  '行政办事人员', '商业服务人员', '生产运输人员', '农林牧渔人员', '军警', '其他',
];

// ── Field detection ───────────────────────────────────────────

function sampleValues(records: Record<string, unknown>[], key: string, n = 80): string[] {
  return records.slice(0, n).map(r => String(r[key] ?? '').trim()).filter(Boolean);
}

function hitRate(values: string[], lookup: Record<string, string>): number {
  if (!values.length) return 0;
  return values.filter(v => lookup[v] !== undefined).length / values.length;
}

export interface EnrichableField {
  field: Field;
  enrichType: 'region' | 'cityTier' | 'occupation';
  newFieldKey: string;
  newFieldName: string;
}

export function detectEnrichable(dataset: Dataset): EnrichableField[] {
  const result: EnrichableField[] = [];
  const existingKeys = new Set(dataset.fields.map(f => f.key));

  // If any field is already named "大区" or ends with __region, skip region derivation entirely
  const hasRegionField = dataset.fields.some(
    f => f.name.includes('大区') || f.key.endsWith('__region'),
  );
  let regionAdded = false; // at most one 大区 per dataset

  for (const field of dataset.fields) {
    if (field.type !== 'single_choice' && field.type !== 'text') continue;

    const vals = sampleValues(dataset.records, field.key);
    const nameLC = field.name.toLowerCase();

    // Province/city → region (only if no existing 大区 field and none added this pass)
    const regionKey = `${field.key}__region`;
    if (!hasRegionField && !regionAdded && !existingKeys.has(regionKey)) {
      const provinceHit = hitRate(vals, PROVINCE_REGION);
      const cityHit = hitRate(vals, CITY_PROVINCE);
      if (provinceHit >= 0.5 || cityHit >= 0.5) {
        result.push({ field, enrichType: 'region', newFieldKey: regionKey, newFieldName: '大区' });
        regionAdded = true; // prevent a second 大区 from a different province/city field
      }
    }

    // City → tier
    const tierKey = `${field.key}__tier`;
    if (!existingKeys.has(tierKey)) {
      const cityHit = hitRate(vals, CITY_TIER);
      // Also trigger if the field name looks like a city field with ~30%+ city hits
      if (cityHit >= 0.3) {
        result.push({ field, enrichType: 'cityTier', newFieldKey: tierKey, newFieldName: '城市级别' });
      }
    }

    // Occupation → category
    const occKey = `${field.key}__occ`;
    if (!existingKeys.has(occKey)) {
      const isOccupation = ['职业', '工作', '职位', '岗位', '从事', '职务'].some(kw => nameLC.includes(kw));
      if (isOccupation) {
        result.push({ field, enrichType: 'occupation', newFieldKey: occKey, newFieldName: '职业类别' });
      }
    }
  }

  return result;
}

// ── Enrichment application ────────────────────────────────────

function makeDerivedField(
  records: Record<string, unknown>[],
  key: string,
  name: string,
  orderedValues?: string[],
): Field {
  const vals = records.map(r => String(r[key] ?? '').trim()).filter(Boolean);
  const freq = new Map<string, number>();
  for (const v of vals) freq.set(v, (freq.get(v) ?? 0) + 1);

  return {
    key,
    name,
    type: 'single_choice' as FieldType,
    statistics: {
      count: records.length,
      unique: freq.size,
      missing: records.length - vals.length,
      topValues: [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([value, count]) => ({ value, count })),
    },
    orderedValues: orderedValues ?? [],
    recommendedCharts: ['bar', 'pie', 'donut'],
    derived: true,
  };
}

export function applyRegionEnrichment(dataset: Dataset, enrich: EnrichableField): Dataset {
  const records = dataset.records.map(r => {
    const val = String(r[enrich.field.key] ?? '').trim();
    let region = PROVINCE_REGION[val];
    if (!region) {
      const prov = CITY_PROVINCE[val];
      if (prov) region = PROVINCE_REGION[prov];
    }
    return { ...r, [enrich.newFieldKey]: region ?? '' };
  });

  return {
    ...dataset,
    records,
    rowCount: dataset.rowCount,
    fields: [...dataset.fields, makeDerivedField(records, enrich.newFieldKey, enrich.newFieldName, REGION_ORDER)],
  };
}

export function applyCityTierEnrichment(dataset: Dataset, enrich: EnrichableField): Dataset {
  const records = dataset.records.map(r => {
    const val = String(r[enrich.field.key] ?? '').trim();
    return { ...r, [enrich.newFieldKey]: CITY_TIER[val] ?? '其他' };
  });

  return {
    ...dataset,
    records,
    rowCount: dataset.rowCount,
    fields: [...dataset.fields, makeDerivedField(records, enrich.newFieldKey, enrich.newFieldName, CITY_TIER_ORDER)],
  };
}

export function applyOccupationEnrichment(
  dataset: Dataset,
  enrich: EnrichableField,
  mapping: Record<string, string>,
): Dataset {
  const records = dataset.records.map(r => {
    const val = String(r[enrich.field.key] ?? '').trim();
    return { ...r, [enrich.newFieldKey]: mapping[val] ?? '其他' };
  });

  return {
    ...dataset,
    records,
    rowCount: dataset.rowCount,
    fields: [...dataset.fields, makeDerivedField(records, enrich.newFieldKey, enrich.newFieldName, OCCUPATION_CATEGORIES)],
  };
}
