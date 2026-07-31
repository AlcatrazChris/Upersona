import assert from 'node:assert/strict';
import { ensureDescendingOrder, resolveAIOrder } from '../src/lib/aiOrder.ts';

const values = ['低', '中', '高'];
assert.deepEqual(
  resolveAIOrder('{"isOrdered":true,"orderedIndices":[2,1,0]}', values),
  { isOrdered: true, orderedValues: ['高', '中', '低'] },
);
assert.deepEqual(
  resolveAIOrder('```json\n{"isOrdered":false,"orderedIndices":[]}\n```', values),
  { isOrdered: false, orderedValues: [] },
);
assert.throws(
  () => resolveAIOrder('{"isOrdered":true,"orderedIndices":[2', values),
  /结果不完整/,
);
assert.deepEqual(
  ensureDescendingOrder(['10万元以下', '10~20万元', '20万元以上']),
  ['20万元以上', '10~20万元', '10万元以下'],
);
assert.deepEqual(
  ensureDescendingOrder(['60岁以上', '40~59岁', '20~39岁']),
  ['60岁以上', '40~59岁', '20~39岁'],
);

console.log('ai order resolver: ok');
