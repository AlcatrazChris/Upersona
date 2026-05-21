import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 解析多选字段（┋ 分隔），同时归并"其他〖...〗"
export function parseMultiSelect(raw: string | null | undefined): string[] {
  if (!raw || raw === '(跳过)') return [];
  return raw
    .split('┋')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => {
      // 归并长尾"其他〖XXX〗"为"其他"
      if (v.startsWith('其他〖') || v.startsWith('其他（')) return '其他';
      return v;
    });
}

// 格式化百分比（保留 1 位小数）
export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// 格式化数字（千分位）
export function fmtNum(n: number): string {
  return n.toLocaleString('zh-CN');
}

// 意向分数 → 颜色
export function intentScoreColor(score: number): string {
  if (score >= 70) return 'text-ios-green';
  if (score >= 40) return 'text-ios-orange';
  return 'text-ios-red';
}

// 意向分数 → 等级文字
export function intentScoreLabel(score: number): { level: string; color: string } {
  if (score >= 70) return { level: '高意向', color: '#34C759' };
  if (score >= 40) return { level: '中意向', color: '#FF9500' };
  return { level: '低意向', color: '#FF3B30' };
}

// 生成缓存 key
export function makeCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

// 颜色调色板（用于图表）
export const CHART_COLORS = [
  '#007AFF', // iOS Blue
  '#34C759', // iOS Green
  '#FF9500', // iOS Orange
  '#5856D6', // iOS Indigo
  '#FF2D55', // iOS Pink
  '#5AC8FA', // iOS Teal
  '#AF52DE', // iOS Purple
  '#FFCC00', // iOS Yellow
  '#32ADE6', // iOS Cyan
  '#FF3B30', // iOS Red
];

// 获取图表颜色（循环）
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
