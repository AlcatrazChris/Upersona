import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { classifyPreviousVehicle } from '../src/lib/vehicleClassifier.ts';

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  throw new Error('用法: node --experimental-strip-types scripts/reclassify-xingguang-vehicles.mjs <原始文件> <清洗文件>');
}

const rawBook = XLSX.readFile(source);
const cleanBook = XLSX.readFile(output);
const rawRows = XLSX.utils.sheet_to_json(rawBook.Sheets[rawBook.SheetNames[0]], { header: 1, defval: '', raw: false });
const rows = XLSX.utils.sheet_to_json(cleanBook.Sheets[cleanBook.SheetNames[0]], { header: 1, defval: '', raw: false });
const rawIndex = rawRows[0].findIndex(value => String(value).includes('上一辆车'));
const previousIndex = rows[0].indexOf('上一辆车');
const legacyIndex = rows[0].indexOf('上一辆车类别');
const brandIndex = rows[0].indexOf('上一辆车品牌');
assert(rawIndex >= 0 && previousIndex >= 0 && (legacyIndex >= 0 || brandIndex >= 0), '未找到上一辆车字段');
assert.equal(rawRows.length, rows.length, '原始数据与清洗数据行数不一致');

const targetBrandIndex = brandIndex >= 0 ? brandIndex : legacyIndex;
rows[0][targetBrandIndex] = '上一辆车品牌';
let typeIndex = rows[0].indexOf('旧车类型');
if (typeIndex < 0) {
  typeIndex = targetBrandIndex + 1;
  for (const row of rows) row.splice(typeIndex, 0, '');
  rows[0][typeIndex] = '旧车类型';
}

const brandCounts = new Map();
const typeCounts = new Map();
for (let index = 1; index < rows.length; index += 1) {
  const result = classifyPreviousVehicle(rawRows[index][rawIndex]);
  rows[index][targetBrandIndex] = result.brand;
  rows[index][typeIndex] = result.type;
  brandCounts.set(result.brand || '(空)', (brandCounts.get(result.brand || '(空)') ?? 0) + 1);
  typeCounts.set(result.type || '(空)', (typeCounts.get(result.type || '(空)') ?? 0) + 1);
}

const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '清洗数据');
XLSX.writeFile(book, output, { bookType: 'xlsx', bookSST: true, compression: true });
const sorted = counts => Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]));
console.log(JSON.stringify({ brands: sorted(brandCounts), types: sorted(typeCounts) }, null, 2));
