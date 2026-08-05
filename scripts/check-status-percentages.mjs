import assert from 'node:assert/strict';
import {
  aggregateByStatusGroups,
  aggregateCrossDatasetByStatus,
  aggregateField,
} from '../src/lib/dataAggregator.ts';

const field = {
  key: 'choices', name: 'choices', type: 'multi_choice', multiDelimiter: '┋',
  recommendedCharts: ['bar'],
};
const groups = [
  { key: 'before', label: 'before', values: ['before'] },
  { key: 'after', label: 'after', values: ['after'] },
];
const records = [
  { status: 'before', choices: 'A┋B' },
  { status: 'before', choices: 'B' },
  { status: 'after', choices: 'A┋C' },
];

const sum = (items, key = 'percentage') =>
  Number(items.reduce((total, item) => total + Number(item[key] ?? 0), 0).toFixed(1));

assert.equal(sum(aggregateField(records, field)), 100);

const grouped = aggregateByStatusGroups(records, field, 'status', groups);
assert.equal(sum(grouped.items, 'before'), 100);
assert.equal(sum(grouped.items, 'after'), 100);
assert.equal(grouped.groupTotals.before, 2, 'n must remain the valid respondent count');

const cross = aggregateCrossDatasetByStatus(
  { records, label: 'primary' },
  { records, label: 'compare' },
  field,
  'status',
  groups,
);
assert.equal(sum(cross.items, 'primary · before'), 100);
assert.equal(sum(cross.items, 'compare · after'), 100);

console.log('status percentage check passed');
