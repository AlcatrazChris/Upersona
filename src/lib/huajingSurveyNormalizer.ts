import { CITY_TIER, PROVINCE_REGION } from './fieldEnricher';
import { normalizeIndustryValues } from './industryNormalizer';
import { classifyPreviousVehicle } from './vehicleClassifier';

const OUTPUT_HEADERS = [
  '提交答卷时间', '订单状态', '姓名', '大区', '省份', '城市', '区县', '城市级别',
  '购车配置', '性别', '年龄段', '学历', '从事行业', '工作单位类型', '岗位级别', '职业类型',
  '工作生活状态', '工作年限', '家庭年收入', '家庭年消费支出', '家庭前三位消费支出',
  '婚育情况', '孩子年龄段', '与孩子居住形态', '与父母居住形态', '家庭同住人数',
  '乘客照顾优先级', '主要用途场景', '购车动因', '购车具体原因', '购车类型', '上一辆车',
  '上一辆车品牌', '旧车类型', '了解渠道', '决策信息类型', '预算上限（万元）',
  '预算下限（万元）', '核心关注因素', '对比车型', '最终选购关键因素', '智驾使用经验',
  '智驾依赖程度', '华为品牌影响程度', '华为粉丝属性', '手机品牌型号', '消费观念',
  '汽车价值观', '华境S认同关键词', '推荐意愿', '推荐亮点', '不推荐原因',
];

const SKIP = /^(?:\(跳过\)|（跳过）|跳过)$/;
const OTHER = /其他(?:原因)?\s*[〖【][^〗】]*[〗】]/g;
const EXPLANATION = /\s*[（(][^（）()]*[）)]\s*/g;

function clean(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || SKIP.test(raw)) return '';
  return raw.split('┋').map(part => {
    let result = part.trim().replace(OTHER, '其他').replace(EXPLANATION, '').trim();
    if (/[:：]/.test(result)) result = result.split(/[:：]/, 1)[0].trim();
    return result;
  }).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join('┋');
}

function geo(value: unknown): string[] {
  const [rawProvince = '', rawCity = '', ...districts] = String(value ?? '').split('-').map(item => item.trim());
  const province = rawProvince.replace(/[省市]$/, '');
  const city = rawCity.replace(/市$/, '') || province;
  return [PROVINCE_REGION[province] ?? '', province, city, districts.join('-'), CITY_TIER[city] ?? '四线城市及以下'];
}

export function normalizeHuajingSurvey(records: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!records.length) return records;
  const headers = Object.keys(records[0]);
  if (headers.length < 100 || !headers.some(header => header.includes('您华境S的配置')) ||
      !headers.some(header => header.includes('您目前从事的行业'))) return records;

  const at = (record: Record<string, unknown>, index: number) => record[headers[index]];
  return records.map(record => {
    const previous = at(record, 32);
    const vehicle = classifyPreviousVehicle(previous);
    const values = [
      at(record, 1), '已提车', clean(at(record, 6)), ...geo(at(record, 8)),
      ...Array.from({ length: 24 }, (_, offset) => clean(at(record, 9 + offset))),
      vehicle.brand, vehicle.type,
      ...Array.from({ length: 18 }, (_, offset) => clean(at(record, 33 + offset))),
    ];
    values[12] = normalizeIndustryValues([13, 14, 15, 16].map(index => at(record, index)));
    return Object.fromEntries(OUTPUT_HEADERS.map((header, index) => [header, values[index] ?? '']));
  });
}
