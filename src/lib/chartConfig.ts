export type LegendPosition = 'bottom' | 'top' | 'right' | 'left';

export interface ChartConfig {
  colorScheme:    ColorScheme;
  showXAxis:      boolean;
  showYAxis:      boolean;
  showGrid:       boolean;
  showLabel:      boolean;
  showLegend:     boolean;
  legendPosition: LegendPosition;  // 新增：图例位置
  showSampleCount:boolean;          // 新增：是否显示样本数
  showTooltip:    boolean;
  axisFontSize:   number;
  labelFontSize:  number;
  legendFontSize: number;
  barRadius:      number;
  barOpacity:     number;
}

export type ColorScheme =
  | 'ios' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'mono' | 'brand';

export const COLOR_SCHEMES: Record<ColorScheme, { name: string; colors: string[]; preview: string[] }> = {
  ios:      { name: 'iOS 系统',  preview: ['#007AFF','#34C759','#FF9500','#5856D6','#FF2D55'], colors: ['#007AFF','#34C759','#FF9500','#5856D6','#FF2D55','#5AC8FA','#AF52DE','#FFCC00','#32ADE6','#FF3B30'] },
  ocean:    { name: '海洋蓝绿',  preview: ['#006994','#0099CC','#00BCD4','#4DD0E1','#80DEEA'], colors: ['#006994','#0099CC','#00BCD4','#26C6DA','#4DD0E1','#80DEEA','#B2EBF2','#0277BD','#01579B','#0288D1'] },
  sunset:   { name: '日落橙红',  preview: ['#E53935','#F4511E','#FB8C00','#FDD835','#FF7043'], colors: ['#E53935','#F4511E','#FB8C00','#FDD835','#FF7043','#EF5350','#FF8A65','#FFCA28','#FF6F00','#BF360C'] },
  forest:   { name: '森林绿',    preview: ['#1B5E20','#388E3C','#66BB6A','#A5D6A7','#2E7D32'], colors: ['#1B5E20','#2E7D32','#388E3C','#43A047','#66BB6A','#81C784','#A5D6A7','#1A6B2A','#00695C','#004D40'] },
  lavender: { name: '薰衣草紫',  preview: ['#4A148C','#7B1FA2','#AB47BC','#CE93D8','#9C27B0'], colors: ['#4A148C','#6A1B9A','#7B1FA2','#8E24AA','#9C27B0','#AB47BC','#BA68C8','#CE93D8','#5E35B1','#3949AB'] },
  mono:     { name: '单色灰度',  preview: ['#212121','#424242','#616161','#757575','#9E9E9E'], colors: ['#212121','#37474F','#455A64','#546E7A','#607D8B','#78909C','#90A4AE','#B0BEC5','#263238','#1A237E'] },
  brand:    { name: '品牌配色',  preview: ['#0A2463','#3E92CC','#D8315B','#F4A261','#2EC4B6'], colors: ['#0A2463','#1E6091','#3E92CC','#2EC4B6','#F4A261','#D8315B','#E9C46A','#264653','#2A9D8F','#E76F51'] },
};

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  colorScheme:     'ios',
  showXAxis:       true,
  showYAxis:       true,
  showGrid:        false,
  showLabel:       true,
  showLegend:      true,
  legendPosition:  'bottom',
  showSampleCount: true,
  showTooltip:     true,
  axisFontSize:    12,
  labelFontSize:   11,
  legendFontSize:  12,
  barRadius:       4,
  barOpacity:      0.82,
};

export type PageKey = 'profile' | 'compare' | 'insights' | 'predict';

function storageKey(page: PageKey) { return `huajing-chart-config-${page}`; }

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
