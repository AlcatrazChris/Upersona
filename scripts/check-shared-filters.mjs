import assert from 'node:assert/strict';
import { filterByDateBlocks } from '../src/lib/timeStatus.ts';

const records = [
  { date: '2026-07-15', id: 1 },
  { date: '2026-07-16', id: 2 },
  { date: '2026-08-01', id: 3 },
];
const field = { key: 'date', name: '日期', type: 'date' };
const blocks = [
  { key: 'before716', label: '716前', start: '2026-01-01', end: '2026-07-15' },
  { key: 'after716', label: '716后', start: '2026-07-16', end: '2026-12-31' },
];

assert.deepEqual(filterByDateBlocks(records, field, ['before716'], blocks).map(item => item.id), [1]);
assert.deepEqual(filterByDateBlocks(records, field, ['after716'], blocks).map(item => item.id), [2, 3]);
assert.equal(filterByDateBlocks(records, field, ['__all'], blocks).length, 3);
assert.equal(filterByDateBlocks(records, field, ['legacy-month'], blocks).length, 3);
console.log('shared filter check passed');
