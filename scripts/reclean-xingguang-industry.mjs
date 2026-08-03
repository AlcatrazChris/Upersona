import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { normalizeIndustry } from '../src/lib/industryNormalizer.ts';

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  throw new Error('用法: node --experimental-strip-types scripts/reclean-xingguang-industry.mjs <原始文件> <清洗文件>');
}

const readRows = file => {
  const book = XLSX.readFile(file, { cellDates: true });
  return {
    book,
    rows: XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
      header: 1, defval: '', raw: false,
    }),
  };
};

const raw = readRows(source);
const clean = readRows(output);
const rawIndex = raw.rows[0].findIndex(value => /从事.*行业/.test(String(value)));
const cleanIndex = clean.rows[0].findIndex(value => String(value) === '从事行业');
assert(rawIndex >= 0 && cleanIndex >= 0, '未找到从事行业列');
assert.equal(raw.rows.length, clean.rows.length, '原始数据与清洗数据行数不一致');

const counts = new Map();
for (let row = 1; row < clean.rows.length; row += 1) {
  const value = normalizeIndustry(raw.rows[row][rawIndex]);
  clean.rows[row][cleanIndex] = value;
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(clean.rows), '清洗数据');
XLSX.writeFile(book, output, { bookType: 'xlsx', bookSST: true, compression: true });
console.log(JSON.stringify(Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])), null, 2));
