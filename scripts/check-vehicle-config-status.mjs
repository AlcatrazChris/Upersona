import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/viewConfig.ts', import.meta.url), 'utf8');
assert.match(source, /function vehicleConfigField/);
assert.match(source, /\\u8f66\\u578b\\u914d\\u7f6e\|\\u914d\\u7f6e\\u8f66\\u578b\|\\u8f66\\u578b\\u7248\\u672c/);
assert.match(source, /explicitOrderStatusField\(dataset\) \?\? vehicleConfigField\(dataset\)/);
assert.match(source, /statusVariableName: config\.statusVariableName\?\.trim\(\) \|\| comparisonField\.name/);
console.log('vehicle config status detection check passed');
