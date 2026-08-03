const CANONICAL = new Set([
  '公共管理与事业单位', '制造与工业服务', '商贸零售与个体经营',
  '建筑与房地产', '教育培训', '信息技术与互联网通信',
  '住宿餐饮与生活服务', '医疗健康与社会服务', '金融与财会',
  '能源矿产与公用事业', '交通物流与邮政', '科研与专业服务',
  '农林牧渔', '文化体育娱乐与旅游', '水利环境与公共设施',
  '自由职业（行业未明确）', '未就业/学生', '退休', '租赁服务', '其他',
]);

export function normalizeIndustry(value: unknown): string {
  const text = String(value ?? '').trim();
  if (CANONICAL.has(text)) return text;

  if (/退休|离休|退修|已退/.test(text)) return '退休';
  if (/自由职业/.test(text)) return '自由职业（行业未明确）';
  if (/没有工作|无业|待业|学生|主妇|主夫/.test(text)) return '未就业/学生';
  if (/水利|环境和公共设施|环境与公共设施/.test(text)) return '水利环境与公共设施';
  if (/政府|事业单位|国企|国有企业|检察院|军队|部队|军人|军警|社区|社会组织|社会团体|香港政府|退役军人/.test(text)) return '公共管理与事业单位';
  if (/建筑|房地产|装修|装饰|物业/.test(text)) return '建筑与房地产';
  if (/批发|零售|电商|外贸|贸易|销售|导购|商业|酒类|彩票|手机批发|小买卖|商人|做生意|经营者|个体|创业|自营店主|市场管理|区域经理/.test(text)) return '商贸零售与个体经营';
  if (/教育|培训|教师/.test(text)) return '教育培训';
  if (/医疗|卫生|社会保障|社会福利|医生|药品|生物实验|医疗器械/.test(text)) return '医疗健康与社会服务';
  if (/金融|财务|会计/.test(text)) return '金融与财会';
  if (/计算机|软件|互联网|通信|通讯|电信|物联网|自媒体|AI|光通信/.test(text)) return '信息技术与互联网通信';
  if (/物流|交通|仓储|邮政|司机|客运|公路|高速|收费员|外卖|校车|铁路|公交/.test(text)) return '交通物流与邮政';
  if (/住宿|酒店|餐饮|生活服务|美容|美发|洗护|家政|客服|丧葬|服务业|服务〗/.test(text)) return '住宿餐饮与生活服务';
  if (/农、林、牧、渔|农民/.test(text)) return '农林牧渔';
  if (/电力|燃气|水生产|采矿|能源|石油|化工|炼油|石化|危化|新能源|柴汽油/.test(text)) return '能源矿产与公用事业';
  if (/科学研究|技术服务|地质勘查|专业服务|法律|咨询|设计服务|广告服务|中介/.test(text)) return '科研与专业服务';
  if (/文化|体育|娱乐|旅游|演员|摄影|舞美/.test(text)) return '文化体育娱乐与旅游';
  if (/出租|租赁/.test(text)) return '租赁服务';
  if (/制造|生产|加工|汽车|汽配|纺织|羽绒|服装|家具|家电|食品工厂|维修|汽修|机动车检测|弱电工|技术工|工人|飞机维修|建材|五金|试驾车/.test(text)) return '制造与工业服务';
  return '其他';
}

export function normalizeIndustryFields(
  records: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (!records.length) return records;
  const industryKeys = Object.keys(records[0]).filter(key => /从事.*行业/.test(key));
  if (!industryKeys.length) return records;

  return records.map(record => {
    const normalized = { ...record };
    for (const key of industryKeys) normalized[key] = normalizeIndustry(record[key]);
    return normalized;
  });
}
