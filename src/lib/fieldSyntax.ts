export const MULTI_CHOICE_DELIMITER = '┋';
export const RANKING_DELIMITER = '->';

export function splitRankingValue(value: string): string[] {
  if (!value.includes(RANKING_DELIMITER)) return [];
  return value.split(RANKING_DELIMITER).map(part => part.trim()).filter(Boolean);
}
