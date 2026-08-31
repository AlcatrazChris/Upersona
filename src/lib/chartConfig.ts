export type LegendPosition = 'bottom' | 'top' | 'right' | 'left';
export type LabelType     = 'pct' | 'count' | 'both';
export type LabelPosition = 'auto' | 'inside' | 'outside' | 'center';
export type LegendDirection = 'horizontal' | 'vertical';

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
  topN?:           number;   // 0 or undefined = show all; positive = top N bars + 其他
  compact?:        boolean;  // tighter bar spacing and card padding
  labelPosition:   LabelPosition;
  decimalPlaces:   number;
  valuePrefix:     string;
  valueSuffix:     string;
  showZeroLabels:  boolean;
  xAxisTitle:      string;
  yAxisTitle:      string;
  axisMin?:        number;
  axisMax?:        number;
  startAtZero:     boolean;
  tickCount:       number;
  gridColor:       string;
  legendDirection: LegendDirection;
  backgroundColor: string;
  fontFamily:      string;
  chartPadding:    number;
  barGap:          number;
  lineWidth:       number;
  lineCurve:       boolean;
  showMarkers:     boolean;
  markerSize:      number;
  pieInnerRadius:  number;
  piePaddingAngle: number;
  animation:       boolean;
}

export type ColorScheme =
  | 'mckinsey' | 'ios' | 'ocean' | 'sunset' | 'forest' | 'lavender' | 'mono' | 'brand'
  | 'warm' | 'earth' | 'pastel' | 'neon' | 'cool';

export const COLOR_SCHEMES: Record<ColorScheme, { name: string; colors: string[]; preview: string[]; singleColor?: boolean }> = {
  mckinsey: { name: '报告蓝',   singleColor: true,  preview: ['#2563EB','#1E40AF','#94A3B8','#D97706'], colors: ['#2563EB','#1E40AF','#0891B2','#64748B','#D97706','#0F766E','#94A3B8','#CBD5E1'] },
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

export const REPORT_COLOR_SCHEMES: ColorScheme[] = ['mckinsey', 'ocean', 'mono', 'brand'];

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  colorScheme:     'mckinsey',
  showXAxis:       true,
  showYAxis:       true,
  showGrid:        false,
  showLabel:       true,
  labelType:       'pct',
  showLegend:      true,
  legendPosition:  'bottom',
  showSampleCount: true,
  showTooltip:     true,
  axisFontSize:    11,
  labelFontSize:   11,
  legendFontSize:  11,
  barRadius:       0,
  barOpacity:      1,
  chartHeight:     320,
  minBarSize:      20,
  topN:            10,
  compact:         false,
  labelPosition:   'auto',
  decimalPlaces:   0,
  valuePrefix:     '',
  valueSuffix:     '',
  showZeroLabels:  false,
  xAxisTitle:      '',
  yAxisTitle:      '',
  axisMin:         undefined,
  axisMax:         undefined,
  startAtZero:     true,
  tickCount:       5,
  gridColor:       '#e2e8f0',
  legendDirection: 'horizontal',
  backgroundColor: '#ffffff',
  fontFamily:      'inherit',
  chartPadding:    8,
  barGap:          3,
  lineWidth:       2,
  lineCurve:       false,
  showMarkers:     true,
  markerSize:      4,
  pieInnerRadius:  56,
  piePaddingAngle: 1,
  animation:       true,
};

// 通用 pageKey（任意字符串即可，用于 localStorage 隔离）
export type PageKey = string;

export const CHART_CAPABILITIES: Record<string, Set<keyof ChartConfig>> = {
  bar: new Set(['colorScheme','showXAxis','showYAxis','showGrid','showLabel','labelType','showSampleCount','showTooltip','axisFontSize','labelFontSize','barRadius','barOpacity','chartHeight','minBarSize','topN','compact']),
  lollipop: new Set(['colorScheme','showXAxis','showYAxis','showGrid','showSampleCount','showTooltip','axisFontSize','barOpacity','chartHeight','topN']),
  waffle: new Set(['colorScheme','showLabel','showLegend','showSampleCount','labelFontSize','legendFontSize','barOpacity','topN']),
  wordcloud: new Set(['colorScheme','showLabel','showSampleCount','showTooltip','labelFontSize','barOpacity','chartHeight','topN','compact']),
  pie: new Set(['colorScheme','showLabel','labelType','showLegend','legendPosition','showSampleCount','showTooltip','labelFontSize','legendFontSize','barOpacity','chartHeight','topN']),
  donut: new Set(['colorScheme','showLabel','labelType','showLegend','legendPosition','showSampleCount','showTooltip','labelFontSize','legendFontSize','barOpacity','chartHeight','topN']),
  line: new Set(['colorScheme','showXAxis','showYAxis','showGrid','showLabel','showSampleCount','showTooltip','axisFontSize','labelFontSize','barOpacity','chartHeight']),
  area: new Set(['colorScheme','showXAxis','showYAxis','showGrid','showLabel','showSampleCount','showTooltip','axisFontSize','labelFontSize','barOpacity','chartHeight']),
  boxplot: new Set(['colorScheme','showXAxis','showLabel','showSampleCount','axisFontSize','labelFontSize','barOpacity','chartHeight']),
  grouped: new Set(['colorScheme','showXAxis','showYAxis','showGrid','showLabel','showLegend','legendPosition','legendDirection','showSampleCount','showTooltip','axisFontSize','labelFontSize','legendFontSize','barRadius','barOpacity','chartHeight','minBarSize']),
  stacked: new Set(['colorScheme','showXAxis','showYAxis','showGrid','showLabel','showLegend','legendPosition','legendDirection','showSampleCount','showTooltip','axisFontSize','labelFontSize','legendFontSize','barOpacity','chartHeight','minBarSize']),
  'ranking-heatmap': new Set(['colorScheme','showLabel','showSampleCount','labelFontSize','chartHeight','compact']),
  scatter: new Set(['colorScheme','showXAxis','showYAxis','showGrid','showSampleCount','showTooltip','axisFontSize','barOpacity','chartHeight']),
  histogram: new Set(['colorScheme','showXAxis','showYAxis','showGrid','showLabel','showSampleCount','showTooltip','axisFontSize','labelFontSize','barOpacity','chartHeight']),
  dumbbell: new Set(['colorScheme','showLabel','showSampleCount','showTooltip','labelFontSize','barOpacity','chartHeight','topN','compact']),
  difference: new Set(['colorScheme','showLabel','showSampleCount','labelFontSize','barOpacity','chartHeight','topN','compact']),
  heatmap: new Set(['showLabel','showSampleCount','labelFontSize','chartHeight','topN']),
};

const UNIVERSAL_SETTINGS = new Set<keyof ChartConfig>([
  'backgroundColor', 'fontFamily', 'chartPadding', 'animation',
  'decimalPlaces', 'valuePrefix', 'valueSuffix', 'showZeroLabels',
]);
const AXIS_SETTINGS = new Set<keyof ChartConfig>(['xAxisTitle','yAxisTitle','axisMin','axisMax','startAtZero','tickCount','gridColor']);
const BAR_SETTINGS = new Set<keyof ChartConfig>(['barGap']);
const LINE_SETTINGS = new Set<keyof ChartConfig>(['lineWidth','lineCurve','showMarkers','markerSize']);
const PIE_SETTINGS = new Set<keyof ChartConfig>(['pieInnerRadius','piePaddingAngle']);

export function supportsChartSetting(chartTypes: string[] | undefined, key: keyof ChartConfig) {
  if (!chartTypes?.length) return true;
  if (UNIVERSAL_SETTINGS.has(key)) return true;
  if (AXIS_SETTINGS.has(key)) return chartTypes.every(type => CHART_CAPABILITIES[type]?.has('showXAxis') || CHART_CAPABILITIES[type]?.has('showYAxis'));
  if (BAR_SETTINGS.has(key)) return chartTypes.every(type => ['bar','grouped','stacked'].includes(type));
  if (LINE_SETTINGS.has(key)) return chartTypes.every(type => ['line','area'].includes(type));
  if (PIE_SETTINGS.has(key)) return chartTypes.every(type => ['pie','donut'].includes(type));
  if (key === 'labelPosition') return chartTypes.every(type => CHART_CAPABILITIES[type]?.has('showLabel'));
  if (key === 'legendDirection') return chartTypes.every(type => CHART_CAPABILITIES[type]?.has('showLegend'));
  return chartTypes.every(type => CHART_CAPABILITIES[type]?.has(key) ?? false);
}

export function supportsAnyChartSetting(chartTypes: string[] | undefined, key: keyof ChartConfig) {
  if (!chartTypes?.length) return true;
  if (UNIVERSAL_SETTINGS.has(key)) return true;
  if (AXIS_SETTINGS.has(key)) return chartTypes.some(type => CHART_CAPABILITIES[type]?.has('showXAxis') || CHART_CAPABILITIES[type]?.has('showYAxis'));
  if (BAR_SETTINGS.has(key)) return chartTypes.some(type => ['bar','grouped','stacked'].includes(type));
  if (LINE_SETTINGS.has(key)) return chartTypes.some(type => ['line','area'].includes(type));
  if (PIE_SETTINGS.has(key)) return chartTypes.some(type => ['pie','donut'].includes(type));
  if (key === 'labelPosition') return chartTypes.some(type => CHART_CAPABILITIES[type]?.has('showLabel'));
  if (key === 'legendDirection') return chartTypes.some(type => CHART_CAPABILITIES[type]?.has('showLegend'));
  return chartTypes.some(type => CHART_CAPABILITIES[type]?.has(key) ?? false);
}

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

export function getContrastingColors(scheme: ColorScheme, count: number): string[] {
  const colors = getColors(scheme);
  if (count <= 0 || colors.length === 0) return [];

  const rgb = colors.map(color => {
    const value = Number.parseInt(color.slice(1), 16);
    return [value >> 16, value >> 8 & 255, value & 255];
  });
  const distance = (a: number, b: number) =>
    rgb[a].reduce((sum, channel, index) => sum + (channel - rgb[b][index]) ** 2, 0);

  const selected = [0];
  while (selected.length < Math.min(count, colors.length)) {
    const candidates = colors
      .map((_, index) => index)
      .filter(index => !selected.includes(index));
    selected.push(candidates.reduce((best, candidate) => {
      const minDistance = Math.min(...selected.map(index => distance(candidate, index)));
      const bestDistance = Math.min(...selected.map(index => distance(best, index)));
      return minDistance > bestDistance ? candidate : best;
    }));
  }

  return Array.from({ length: count }, (_, index) =>
    colors[selected[index % selected.length]]
  );
}

/** Status series are ordered, so their colors must encode that order. */
export function getSequentialColors(scheme: ColorScheme, count: number): string[] {
  if (count <= 0) return [];
  const colors = getColors(scheme);
  const luminance = (color: string) => {
    const value = Number.parseInt(color.slice(1), 16);
    return 0.2126 * (value >> 16) + 0.7152 * (value >> 8 & 255) + 0.0722 * (value & 255);
  };
  const base = colors.reduce((darkest, color) =>
    luminance(color) < luminance(darkest) ? color : darkest,
  colors[0]);
  const value = Number.parseInt(base.slice(1), 16);
  const channels = [value >> 16, value >> 8 & 255, value & 255];

  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : (index / (count - 1)) * 0.68;
    const hex = channels
      .map(channel => Math.round(channel + (255 - channel) * ratio).toString(16).padStart(2, '0'))
      .join('');
    return `#${hex}`;
  });
}

export function isSingleColorScheme(scheme: ColorScheme): boolean {
  return !!COLOR_SCHEMES[scheme].singleColor;
}
