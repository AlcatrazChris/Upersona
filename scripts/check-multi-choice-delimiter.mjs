import assert from 'node:assert/strict';
import XLSX from 'xlsx';

if (!process.argv[2]) throw new Error('请传入清洗后的 Excel 路径');
const workbook = XLSX.readFile(process.argv[2]);
const records = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
const education = records.map(record => String(record['学历'] ?? '')).filter(Boolean);
assert.equal(records.length, 687);
assert(education.includes('高中/中专/职校/技校'));
assert(!education.some(value => ['高中', '中专', '职校', '技校'].includes(value)));

for (const record of records) {
  for (const value of Object.values(record)) {
    const text = String(value ?? '');
    if (!text.includes('┋')) continue;
    assert(text.split('┋').every(part => part.trim().length > 0));
  }
}

console.log('multi-choice delimiter: ok');
