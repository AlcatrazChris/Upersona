import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function fmtNum(n: number): string {
  return n.toLocaleString('zh-CN');
}
