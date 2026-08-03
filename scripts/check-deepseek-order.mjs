import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAIOrderPrompt, ORDERING_SYSTEM_PROMPT, resolveAIOrder } from '../src/lib/aiOrder.ts';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    return match ? [[match[1].trim(), match[2].trim()]] : [];
  }),
);
const apiKey = env.AI_API_KEY || env.DEEPSEEK_API_KEY;
assert.ok(apiKey, 'missing DeepSeek API key');
const baseUrl = env.AI_BASE_URL || 'https://api.deepseek.com/v1';
const model = env.AI_MODEL || 'deepseek-v4-flash';

const cases = [
  ['学历', ['博士', '硕士', '大学本科', '高中/中专/职校/技校', '大专', '初中及以下'], ['博士', '硕士', '大学本科', '大专', '高中/中专/职校/技校', '初中及以下']],
  ['年龄段', ['>60', '≤25', '26~30', '31~35', '36~40', '41~45', '46~50', '51~55', '56~60'], ['>60', '56~60', '51~55', '46~50', '41~45', '36~40', '31~35', '26~30', '≤25']],
  ['工作年限', ['20年以上', '15~20年', '10~15年', '4~6年', '2~4年', '0~2年', '6~10年', '其他'], ['20年以上', '15~20年', '10~15年', '6~10年', '4~6年', '2~4年', '0~2年', '其他']],
  ['家庭年收入', ['>50万元', '<10万元', '45~50万元', '40~45万元', '35~40万元', '30~35万元', '25~30万元', '20~25万元', '15~20万元', '10~15万元'], ['>50万元', '45~50万元', '40~45万元', '35~40万元', '30~35万元', '25~30万元', '20~25万元', '15~20万元', '10~15万元', '<10万元']],
  ['孩子年龄段', ['18岁及以上在学的孩子', '孩子已参加工作已经结婚', '孩子已参加工作但未结婚', '12-18岁中学阶段青少年', '6-12岁小学阶段儿童', '1-3岁幼儿', '3-6岁学前儿童'], ['孩子已参加工作已经结婚', '孩子已参加工作但未结婚', '18岁及以上在学的孩子', '12-18岁中学阶段青少年', '6-12岁小学阶段儿童', '3-6岁学前儿童', '1-3岁幼儿']],
  ['家庭同住人数', ['自己独居', '7人', '6人', '5人', '4人', '3人', '2人'], ['7人', '6人', '5人', '4人', '3人', '2人', '自己独居']],
];

async function run([fieldName, values, expected]) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: ORDERING_SYSTEM_PROMPT },
        { role: 'user', content: buildAIOrderPrompt(fieldName, values) },
      ],
      max_tokens: 500,
      temperature: 0,
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`${fieldName}: API ${response.status} ${await response.text()}`);
  const data = await response.json();
  const result = resolveAIOrder(data.choices?.[0]?.message?.content ?? '', values);
  assert.deepEqual(result.orderedValues, expected, `${fieldName}: ${JSON.stringify(result.orderedValues)}`);
  return fieldName;
}

console.log('deepseek ordering:', (await Promise.all(cases.map(run))).join(', '), 'ok');
