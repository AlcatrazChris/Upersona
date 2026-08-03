import assert from 'node:assert/strict';
import { summarizeBoxPlot } from '../src/lib/boxPlot.ts';

assert.deepEqual(summarizeBoxPlot([5, 1, 4, 2, 3]), {
  min: 1, q1: 2, median: 3, q3: 4, max: 5, count: 5,
});
assert.equal(summarizeBoxPlot([NaN, Infinity]), null);

console.log('box plot: ok');
