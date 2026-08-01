import assert from 'node:assert/strict';
import { resolveAIOrder } from '../src/lib/aiOrder.ts';

const values = ['<10万', '10-20万', '≥20万', '其他'];
assert.deepEqual(
  resolveAIOrder('{"isOrdered":true,"orderedIndices":[2,1,0,3]}', values),
  { isOrdered: true, orderedValues: ['≥20万', '10-20万', '<10万', '其他'] },
);
assert.deepEqual(
  resolveAIOrder('```json\n{"isOrdered":false,"orderedIndices":[]}\n```', values),
  { isOrdered: false, orderedValues: [] },
);
assert.throws(
  () => resolveAIOrder('{"isOrdered":true,"orderedIndices":[2,1]}', values),
  /缺少选项/,
);

console.log('ai order resolver: ok');
