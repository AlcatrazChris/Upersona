import assert from 'node:assert/strict';
import { clampYAxisWidth } from '../src/lib/chartLayout.ts';

assert.equal(clampYAxisWidth(40), 64);
assert.equal(clampYAxisWidth(180), 180);
assert.equal(clampYAxisWidth(400), 320);
console.log('y-axis width: ok');
