import assert from 'node:assert/strict';
import {
  normalizeIndustry,
  normalizeIndustryFields,
} from '../src/lib/industryNormalizer.ts';

assert.equal(normalizeIndustry('其他〖通信运营商〗'), '信息技术与互联网通信');
assert.equal(normalizeIndustry('其他〖国企退休人员〗'), '退休');
assert.equal(normalizeIndustry('其他〖自由职业〗'), '自由职业（行业未明确）');
assert.equal(normalizeIndustry('水利环境公共设施管理'), '水利环境与公共设施');
assert.equal(normalizeIndustry('没有工作(如主妇、主夫、无业待业等)'), '未就业/学生');
assert.equal(normalizeIndustry('其他〖铁路〗'), '交通物流与邮政');
assert.equal(normalizeIndustry('军人/军警行业'), '公共管理与事业单位');
assert.equal(normalizeIndustry('其他〖羽绒行业〗'), '制造与工业服务');
assert.deepEqual(
  normalizeIndustryFields([{ '8、您目前从事的行业：': '其他〖汽车销售〗' }]),
  [{ '8、您目前从事的行业：': '商贸零售与个体经营' }],
);

console.log('industry normalizer: ok');
