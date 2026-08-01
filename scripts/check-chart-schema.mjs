import assert from 'node:assert/strict';
import { chartSchemaFromLegacy, chartSchemaValidator } from '../src/types/chartSchema.ts';

const schema = chartSchemaFromLegacy('dataset-1', {
  id: 'chart-1',
  fieldKey: 'education',
  chartType: 'bar',
  title: '学历',
  config: { chartHeight: 320 },
});

assert.equal(schema.version, 1);
assert.equal(schema.data.datasetId, 'dataset-1');
assert.equal(schema.data.fieldKey, 'education');
assert.equal(schema.layout.height, 320);
assert.equal(chartSchemaValidator.safeParse(schema).success, true);

console.log('chart schema: ok');
