import assert from 'node:assert/strict';
import { normalizeSurveyFields, simplifySurveyFieldName } from '../src/lib/surveyNormalizer.ts';

assert.equal(simplifySurveyFieldName('28\u3001\u60a8\u4e86\u89e3\u5230\u534e\u5883S\u7684\u7684\u6e20\u9053\u662f\uff1a'), '\u4e86\u89e3\u6e20\u9053');
assert.equal(simplifySurveyFieldName('6\u3001\u60a8\u4e86\u89e3\u626c\u5149Pro\u7684\u6e20\u9053\uff1a'), '\u4e86\u89e3\u6e20\u9053');
assert.equal(simplifySurveyFieldName('17\u3001\u60a8\u7684\u539f\u6709\u8f66\u578b\uff1a'), '\u539f\u6709\u8f66\u578b');

assert.deepEqual(normalizeSurveyFields([{ '28\u3001\u60a8\u4e86\u89e3\u5230\u534e\u5883S\u7684\u7684\u6e20\u9053\u662f\uff1a': '\u61c2\u8f66\u5e1d\u250b\u6c7d\u8f66\u4e4b\u5bb6\u250b\u6613\u8f66\u7f51\u250b\u670b\u53cb\u63a8\u8350' }]), [{ '\u4e86\u89e3\u6e20\u9053': '\u6c7d\u8f66\u5782\u5a92\u250b\u670b\u53cb\u63a8\u8350' }]);
assert.deepEqual(normalizeSurveyFields([{ '\u4e86\u89e3\u6e20\u9053': '\u5fae\u4fe1\u250b\u61c2\u8f66\u5e1d' }]), [{ '\u4e86\u89e3\u6e20\u9053': '\u5fae\u4fe1\u250b\u6c7d\u8f66\u5782\u5a92' }]);

console.log('survey field and channel normalizer: ok');
