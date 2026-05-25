export type IntentLabel = 0 | 1;
export type RegionType = 'area' | 'province' | 'city';
export type OrderStatus = 'all' | '锁单/提车' | '未锁单' | '退单';

export type OccupationCategory =
  | '管理人员' | '工程技术人员' | '白领' | '公职人员'
  | '个体户' | '基层劳动者' | '自由职业' | '其他';

export interface User {
  id: number; name: string;
  region_area: string; region_province: string; region_city: string;
  age_group: string; education: string;
  occupation_raw: string; occupation_category: OccupationCategory;
  family_structure: string; annual_income: string; is_upgrade: string;
  consumption_views: string[]; competing_models: string[];
  use_scenarios: string[]; family_trip_frequency: string[];
  info_channels: string[]; car_interests: string[]; hobbies: string[];
  order_status: string; intent_label: IntentLabel; data_version: number;
}

export interface ChartDataItem { label: string; count: number; percentage: number; }

export interface DimensionConfig {
  key: keyof User | string; label: string;
  isOrdered: boolean; isMultiSelect: boolean;
  orderedValues?: string[]; note?: string;
}

export interface ProfileData {
  dimension: string; dimensionLabel: string;
  items: ChartDataItem[]; totalSamples: number; validSamples: number;
  isMultiSelect: boolean; note?: string;
}

export interface CompareDataItem {
  region: string; sampleCount: number;
  distribution: { label: string; count: number; percentage: number }[];
}

export interface CompareData {
  dimension: string; dimensionLabel: string;
  regions: CompareDataItem[]; allLabels: string[];
  insight?: string; insightCached: boolean;
}

export interface CoreUserProfile {
  regionType: RegionType; regionName: string;
  orderStatusFilter: OrderStatus;
  sampleCount: number; strongIntentCount: number;
  weakIntentCount: number; strongIntentRatio: number;
  aiCard: {
    title: string;
    bullets: [string, string, string, string]; // 4 要点
    tags: { age?: string; income?: string; competing?: string; attitude?: string; extra?: string };
  } | null;
  cached: boolean;
}

// 雷达图
export interface RadarDimension {
  key: string; label: string; score: number; nationalScore: number;
  regionRaw: number; nationalRaw: number; unit?: string;
}

export interface RadarData {
  regionType: RegionType; regionName: string;
  orderStatus: OrderStatus; sampleCount: number;
  dimensions: RadarDimension[];
  cached: boolean;
}

export interface DataVersion {
  version_id: number; uploaded_at: string;
  record_count: number; is_active: boolean;
}

export const ORDERED_DIMENSIONS: Record<string, string[]> = {
  age_group:             ['50岁以上','45-49岁','40-44岁','35-39岁','30-34岁','30岁以下'],
  education:             ['博士','硕士','本科','大专','高中/中专及以下'],
  family_structure:      ['六口及以上','五口之家','四口之家','三口之家','两口之家','单身'],
  annual_income:         ['50万以上','40-49万','30-39万','24-29万','20-24万','15-19万','15万以下'],
  family_trip_frequency: ['频繁，平均一周一次','较频繁，平均每月一次','较少，平均半年一次','很少，平均一年一次'],
};

export const PROFILE_DIMENSIONS: DimensionConfig[] = [
  { key: 'age_group',             label: '年龄段',          isOrdered: true,  isMultiSelect: false, orderedValues: ORDERED_DIMENSIONS.age_group },
  { key: 'education',             label: '学历',            isOrdered: true,  isMultiSelect: false, orderedValues: ORDERED_DIMENSIONS.education },
  { key: 'occupation_category',   label: '职业',            isOrdered: false, isMultiSelect: false },
  { key: 'family_structure',      label: '家庭结构',        isOrdered: true,  isMultiSelect: false, orderedValues: ORDERED_DIMENSIONS.family_structure },
  { key: 'annual_income',         label: '家庭年收入',      isOrdered: true,  isMultiSelect: false, orderedValues: ORDERED_DIMENSIONS.annual_income },
  { key: 'is_upgrade',            label: '是否增换购',      isOrdered: false, isMultiSelect: false },
  { key: 'consumption_views',     label: '消费观念',        isOrdered: false, isMultiSelect: true,  note: '多选题，总和 > 100%' },
  { key: 'use_scenarios',         label: '用车场景',        isOrdered: false, isMultiSelect: true,  note: '多选题，总和 > 100%' },
  { key: 'family_trip_frequency', label: '与老人小孩出行频率', isOrdered: true, isMultiSelect: true, orderedValues: ORDERED_DIMENSIONS.family_trip_frequency, note: '多选题，总和 > 100%' },
  { key: 'info_channels',         label: '了解华境S的渠道', isOrdered: false, isMultiSelect: true,  note: '多选题，总和 > 100%' },
  { key: 'car_interests',         label: '关注的汽车内容',  isOrdered: false, isMultiSelect: true,  note: '多选题，总和 > 100%' },
  { key: 'hobbies',               label: '日常爱好',        isOrdered: false, isMultiSelect: true,  note: '多选题，总和 > 100%' },
  { key: 'competing_models',      label: '对比车型',        isOrdered: false, isMultiSelect: true,  note: '多选题，总和 > 100%' },
];

export const AREA_LIST = ['东北','中南','中原','华东','华北','华南','西北','西南','其他'];
export const INTENT_WEIGHTS = { strong: 2.0, weak: 1.0 };

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'all',      label: '全部',     color: '#007AFF' },
  { value: '锁单/提车', label: '锁单/提车', color: '#34C759' },
  { value: '未锁单',   label: '未锁单',   color: '#FF9500' },
  { value: '退单',     label: '退单',     color: '#FF3B30' },
];

// ── 雷达图评分权重表 ──
export const RADAR_SCORING = {
  income: { '15万以下':10,'15-19万':25,'20-24万':40,'24-29万':55,'30-39万':70,'40-49万':85,'50万以上':100 } as Record<string,number>,
  education: { '高中/中专及以下':20,'大专':40,'本科':65,'硕士':85,'博士':100 } as Record<string,number>,
  family: { '单身':10,'两口之家':25,'三口之家':45,'四口之家':65,'五口之家':82,'六口及以上':100 } as Record<string,number>,
  occupation: { '管理人员':100,'工程技术人员':88,'公职人员':82,'白领':65,'个体户':60,'自由职业':50,'基层劳动者':28,'其他':15 } as Record<string,number>,
};

export const RADAR_RULE_TEXT = `五维评分规则说明
评分越高代表该维度数值越大，蓝线与灰线的差距反映地区与全国均值的偏差。

① 收入水平（0–100）
  15万以下=10 / 15-19万=25 / 20-24万=40 / 24-29万=55
  30-39万=70 / 40-49万=85 / 50万以上=100
  收入越高，评分越高。

② 学历水平（0–100）
  高中/中专及以下=20 / 大专=40 / 本科=65 / 硕士=85 / 博士=100
  学历越高，评分越高。

③ 家庭规模（0–100）
  单身=10 / 两口之家=25 / 三口之家=45 / 四口之家=65 / 五口之家=82 / 六口及以上=100
  家庭人口越多，评分越高。

④ 职业评分（0–100）
  管理人员=100 / 工程技术人员=88 / 公职人员=82 / 白领=65 / 个体户=60
  自由职业=50 / 基层劳动者=28 / 其他=15
  按职业层次与消费能力设计。

⑤ 年龄层次（0–100）
  30岁以下=10 / 30-34岁=28 / 35-39岁=46 / 40-44岁=64 / 45-49岁=82 / 50岁以上=100
  年龄越大，评分越高。

灰色虚线 = 当前订单状态筛选下的全国均值
蓝色实线 = 当前选中地区的实际得分`;
