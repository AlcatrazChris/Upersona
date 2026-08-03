import assert from 'node:assert/strict';
import { formatStatusDimensionComparison, reorderSelectedKeys } from '../src/lib/statusInsight.ts';

const result = formatStatusDimensionComparison('学历', {
  items: [{ label: '本科', '7月': 40, '8月': 55 }],
  seriesKeys: ['7月', '8月'],
  stackItems: [],
  stackSeriesKeys: [],
  groupTotals: { '7月': 100, '8月': 120 },
  rawCounts: { '7月': { '本科': 40 }, '8月': { '本科': 66 } },
});

assert.equal(result.dimension, '学历');
assert.deepEqual(result.values[0], {
  value: '本科',
  percentages: { '7月': 40, '8月': 55 },
  counts: { '7月': 40, '8月': 66 },
});
assert.deepEqual(reorderSelectedKeys(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
assert.deepEqual(reorderSelectedKeys(['a', 'b'], 'missing', 'a'), ['a', 'b']);
console.log('status insight context check passed');
