export function clampYAxisWidth(width: number, minWidth = 64, maxWidth = 320) {
  return Math.min(maxWidth, Math.max(minWidth, width));
}
