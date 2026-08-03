import assert from 'node:assert/strict';
import { MULTI_CHOICE_DELIMITER, RANKING_DELIMITER, splitRankingValue } from '../src/lib/fieldSyntax.ts';

assert.equal(MULTI_CHOICE_DELIMITER, '┋');
assert.equal(RANKING_DELIMITER, '->');
assert.deepEqual(splitRankingValue('第一->第二->第三'), ['第一', '第二', '第三']);
assert.deepEqual(splitRankingValue('第一→第二'), []);
assert.deepEqual(splitRankingValue('A/B'), []);

console.log('field syntax: ok');
