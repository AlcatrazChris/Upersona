import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { normalizeIndustry } from '../src/lib/industryNormalizer.ts';

const source = path.resolve('.data/wechat/2026-07/366639047_3644_3644.xlsx');
const destination = path.resolve('.data/华境/华境S首批用户调研3644.xlsx');

const workbook = XLSX.readFile(source, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const range = XLSX.utils.decode_range(sheet['!ref']);

let industryColumn = -1;
for (let column = range.s.c; column <= range.e.c; column += 1) {
  const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })];
  if (String(cell?.v ?? '').includes('从事的行业')) {
    industryColumn = column;
    break;
  }
}

if (industryColumn < 0) throw new Error('未找到“从事行业”列');

const counts = new Map();
for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
  const address = XLSX.utils.encode_cell({ r: row, c: industryColumn });
  const cell = sheet[address] ?? { t: 's' };
  const normalized = normalizeIndustry(cell.v);
  cell.t = 's';
  cell.v = normalized;
  delete cell.w;
  sheet[address] = cell;
  counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
XLSX.writeFile(workbook, destination, {
  bookType: 'xlsx',
  bookSST: true,
  compression: true,
});

console.log(JSON.stringify({
  source,
  destination,
  rows: range.e.r - range.s.r,
  categories: Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])),
}, null, 2));
