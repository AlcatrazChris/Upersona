import assert from 'node:assert/strict';
import {
  aggregateByStatusGroups,
  sortChartItemsByCount,
} from '../src/lib/dataAggregator.ts';

assert.deepEqual(
  sortChartItemsByCount([
    { label: '少', count: 1 },
    { label: '多', count: 3 },
  ]).map(item => item.label),
  ['多', '少'],
);

const grouped = aggregateByStatusGroups(
  [
    { status: 'A', answer: '多' },
    { status: 'A', answer: '多' },
    { status: 'B', answer: '多' },
    { status: 'B', answer: '少' },
  ],
  { key: 'answer', name: '答案', type: 'single_choice' },
  'status',
  [
    { key: 'a', label: '状态A', values: ['A'] },
    { key: 'b', label: '状态B', values: ['B'] },
  ],
);
assert.deepEqual(grouped.items.map(item => item.label), ['多', '少']);

console.log('chart ordering: ok');
