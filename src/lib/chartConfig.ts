export type LegendPosition = 'bottom' | 'top' | 'right' | 'left';
export type LabelType     = 'pct' | 'count' | 'both';

export interface ChartConfig {
  colorScheme:     ColorScheme;
  showXAxis:       boolean;
  showYAxis:       boolean;
  showGrid:        boolean;
  showLabel:       boolean;
  labelType:       LabelType;
  showLegend:      boolean;
  legendPosition:  LegendPosition;
  showSampleCount: boolean;
  showTooltip:     boolean;
  axisFontSize:    number;
  labelFontSize:   number;
  legendFontSize:  number;
  barRadius:       number;
  barOpacity:      number;
  chartHeight:     number;
  minBarSize:      number;
}

export type ColorScheme =
  | 'ios' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'mono' | 'brand'
  | 'warm' | 'earth' | 'pastel' | 'neon' | 'cool';

export const COLOR_SCHEMES: Record<ColorScheme, { name: string; colors: string[]; preview: string[] }> = {
  ios:      { name: 'iOS 系统',  preview: ['#007AFF','#34C759','#FF9500','#5856D6','#FF2D55'], colors: ['#007AFF','#34C759','#FF9500','#5856D6','#FF2D55','#5AC8FA','#AF52DE','#FFCC00','#32ADE6','#FF3B30'] },
  ocean:    { name: '海洋蓝绿',  preview: ['#006994','#0099CC','#00BCD4','#4DD0E1','#80DEEA'], colors: ['#006994','#0099CC','#00BCD4','#26C6DA','#4DD0E1','#80DEEA','#B2EBF2','#0277BD','#01579B','#0288D1'] },
  sunset:   { name: '日落橙红',  preview: ['#E53935','#F4511E','#FB8C00','#FDD835','#FF7043'], colors: ['#E53935','#F4511E','#FB8C00','#FDD835','#FF7043','#EF5350','#FF8A65','#FFCA28','#FF6F00','#BF360C'] },
  forest:   { name: '森林绿',    preview: ['#1B5E20','#388E3C','#66BB6A','#A5D6A7','#2E7D32'], colors: ['#1B5E20','#2E7D32','#388E3C','#43A047','#66BB6A','#81C784','#A5D6A7','#1A6B2A','#00695C','#004D40'] },
  lavender: { name: '薰衣草紫',  preview: ['#4A148C','#7B1FA2','#AB47BC','#CE93D8','#9C27B0'], colors: ['#4A148C','#6A1B9A','#7B1FA2','#8E24AA','#9C27B0','#AB47BC','#BA68C8','#CE93D8','#5E35B1','#3949AB'] },
  mono:     { name: '单色灰度',  preview: ['#212121','#424242','#616161','#757575','#9E9E9E'], colors: ['#212121','#37474F','#455A64','#546E7A','#607D8B','#78909C','#90A4AE','#B0BEC5','#263238','#1A237E'] },
  brand:    { name: '品牌配色',  preview: ['#0A2463','#3E92CC','#D8315B','#F4A261','#2EC4B6'], colors: ['#0A2463','#1E6091','#3E92CC','#2EC4B6','#F4A261','#D8315B','#E9C46A','#264653','#2A9D8F','#E76F51'] },
  warm:     { name: '暖色渐变',  preview: ['#FF6B35','#F7C59F','#EFEFD0','#E07A5F','#F2CC8F'], colors: ['#FF6B35','#E07A5F','#F2CC8F','#F7C59F','#EFCFE3','#D4A5A5','#FF8C69','#FFB347','#FFCC80','#F4845F'] },
  earth:    { name: '大地质感',  preview: ['#6B4226','#A0522D','#CD853F','#DEB887','#8B7355'], colors: ['#6B4226','#8B4513','#A0522D','#CD853F','#D2691E','#DEB887','#8B7355','#A9A9A9','#708090','#556B2F'] },
  pastel:   { name: '马卡龙',    preview: ['#FFB3BA','#FFDFBA','#FFFFBA','#BAFFC9','#BAE1FF'], colors: ['#FFB3BA','#FFDFBA','#FFFFBA','#BAFFC9','#BAE1FF','#E8BAFF','#FFD9BA','#B9FBC0','#BDE0FE','#FFDDE1'] },
  neon:     { name: '霓虹活力',  preview: ['#FF073A','#39FF14','#00F5FF','#FF6EC7','#FFFF00'], colors: ['#FF073A','#FF6EC7','#39FF14','#00F5FF','#FFFF00','#BF5FFF','#FF9500','#00FF7F','#FF00FF','#7DF9FF'] },
  cool:     { name: '冷调极简',  preview: ['#1A1A2E','#16213E','#0F3460','#533483','#E94560'], colors: ['#2D3561','#0F3460','#533483','#E94560','#1B4F72','#154360','#1A5276','#0E6655','#117A65','#1F618D'] },
};

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  colorScheme:     'ios',
  showXAxis:       true,
  showYAxis:       true,
  showGrid:        false,
  showLabel:       true,
  labelType:       'pct',
  showLegend:      true,
  legendPosition:  'bottom',
  showSampleCount: true,
  showTooltip:     true,
  axisFontSize:    12,
  labelFontSize:   11,
  legendFontSize:  12,
  barRadius:       4,
  barOpacity:      0.82,
  chartHeight:     320,
  minBarSize:      22,
};

// 通用 pageKey（任意字符串即可，用于 localStorage 隔离）
export type PageKey = string;

function storageKey(page: PageKey) { return `upersona-chart-config-${page}`; }

export function loadChartConfig(page: PageKey): ChartConfig {
  if (typeof window === 'undefined') return DEFAULT_CHART_CONFIG;
  try {
    const saved = localStorage.getItem(storageKey(page));
    if (saved) return { ...DEFAULT_CHART_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_CHART_CONFIG;
}

export function saveChartConfig(page: PageKey, config: ChartConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(page), JSON.stringify(config));
}

export function getColors(scheme: ColorScheme): string[] {
  return COLOR_SCHEMES[scheme].colors;
}
