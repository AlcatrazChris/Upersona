import XLSX from 'xlsx';
import { normalizeIndustry } from '../src/lib/industryNormalizer.ts';

const source = '.data/wechat/2026-07/星光L首批用户调研_555.xlsx';
const output = '.data/星光/星光L首批用户调研555.xlsx';

const sourceBook = XLSX.readFile(source, { cellDates: true });
const sourceRows = XLSX.utils.sheet_to_json(
  sourceBook.Sheets[sourceBook.SheetNames[0]],
  { header: 1, defval: '', raw: false },
);
const sourceTimeIndex = sourceRows[0].findIndex(value =>
  String(value).includes('提交答卷时间')
);
const times = sourceRows.slice(1).map(row => row[sourceTimeIndex]);

const outputBook = XLSX.readFile(output);
const outputRows = XLSX.utils.sheet_to_json(
  outputBook.Sheets[outputBook.SheetNames[0]],
  { header: 1, defval: '' },
);
const headers = outputRows[0];
const industryIndex = headers.indexOf('从事行业');
const keywordIndex = headers.indexOf('华境S认同关键词');
if (industryIndex < 0 || keywordIndex < 0 || times.length !== outputRows.length - 1) {
  throw new Error('星光L清洗结果结构校验失败');
}

headers[keywordIndex] = '星光L认同关键词';
for (let index = 1; index < outputRows.length; index += 1) {
  outputRows[index][industryIndex] = normalizeIndustry(outputRows[index][industryIndex]);
  outputRows[index] = outputRows[index].map(value =>
    ['(跳过)', '（跳过）', '跳过'].includes(String(value ?? '').trim()) ? '' : value
  );
}

const finalRows = [
  ['提交答卷时间', ...headers],
  ...outputRows.slice(1).map((row, index) => [times[index], ...row]),
];
const finalBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  finalBook,
  XLSX.utils.aoa_to_sheet(finalRows),
  '清洗数据',
);
XLSX.writeFile(finalBook, output, {
  bookType: 'xlsx',
  bookSST: true,
  compression: true,
});

console.log(`星光L清洗完成：${finalRows.length - 1} 行 × ${finalRows[0].length} 列`);
