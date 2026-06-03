const SKIPPED_VALUE = '\u0028\u8df3\u8fc7\u0029';

export function isValidSampleValue(value: unknown): value is string {
  const text = String(value ?? '').trim();
  return text !== '' && text !== SKIPPED_VALUE;
}

export function getValidSampleValues(value: unknown, isMultiSelect: boolean): string[] {
  if (isMultiSelect) {
    if (!Array.isArray(value)) return [];
    return value.map(v => String(v ?? '').trim()).filter(isValidSampleValue);
  }

  const text = String(value ?? '').trim();
  return isValidSampleValue(text) ? [text] : [];
}
