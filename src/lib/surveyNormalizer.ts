const MULTI_DELIMITER = '\u250b';
const AUTO_MEDIA = new Set(['\u61c2\u8f66\u5e1d', '\u6c7d\u8f66\u4e4b\u5bb6', '\u6613\u8f66\u7f51']);

export function simplifySurveyFieldName(value: string): string {
  const name = value
    .trim()
    .replace(/^\s*\d+\s*[\u3001.\uff0e]\s*/, '')
    .replace(/[\s\uff1a:?\uff1f]+$/, '')
    .replace(/^(?:\u8bf7\u95ee|\u8bf7\u9009\u62e9|\u8bf7\u586b\u5199)\s*/, '')
    .replace(/^\u60a8(?:\u7684)?/, '');

  if (/(?:\u4e86\u89e3|\u4e86\u89e3\u5230|\u83b7\u77e5).*(?:\u6e20\u9053|\u9014\u5f84)/.test(name)) return '\u4e86\u89e3\u6e20\u9053';
  return name.replace(/\s*(?:\u662f|\u4e3a)$/, '').trim();
}

function normalizeChannel(value: unknown): string {
  const parts = String(value ?? '').split(MULTI_DELIMITER).map(item => item.trim()).filter(Boolean);
  return [...new Set(parts.map(item => AUTO_MEDIA.has(item) ? '\u6c7d\u8f66\u5782\u5a92' : item))].join(MULTI_DELIMITER);
}

export function normalizeSurveyFields(records: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!records.length) return records;
  const headers = Object.keys(records[0]);
  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const header of headers) {
    const base = simplifySurveyFieldName(header) || header;
    let name = base;
    for (let index = 2; used.has(name); index += 1) name = `${base} ${index}`;
    names.set(header, name); used.add(name);
  }
  return records.map(record => Object.fromEntries(headers.map(header => {
    const name = names.get(header)!;
    const value = name === '\u4e86\u89e3\u6e20\u9053' ? normalizeChannel(record[header]) : record[header];
    return [name, value];
  })));
}
