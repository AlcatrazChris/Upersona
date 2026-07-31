import assert from 'node:assert/strict';
import {
  normalizeIndustry,
  normalizeIndustryFields,
} from '../src/lib/industryNormalizer.ts';

assert.equal(normalizeIndustry('其他〖通信运营商〗'), '信息技术与互联网通信');
assert.equal(normalizeIndustry('其他〖国企退休人员〗'), '退休');
assert.equal(normalizeIndustry('其他〖自由职业〗'), '其他');
assert.equal(normalizeIndustry('水利环境公共设施管理'), '其他');
assert.deepEqual(
  normalizeIndustryFields([{ '8、您目前从事的行业：': '其他〖汽车销售〗' }]),
  [{ '8、您目前从事的行业：': '商贸零售与个体经营' }],
);

console.log('industry normalizer: ok');

