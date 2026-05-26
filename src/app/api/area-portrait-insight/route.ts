import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

async function chat(content: string): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content }],
      temperature: 0.65,
      max_tokens: 3000,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { areaStats, nationalTops, dims, orderStatus, regionType } = body;

  // 缓存 key 包含地域组合
  const areaKey = (areaStats as { area: string; n: number }[]).map(a => `${a.area}-${a.n}`).join(',');
  const cacheKey = `area_portrait_v2:${orderStatus}:${regionType || 'area'}:${areaKey}`;

  const db = createServiceClient();
  const { data: cached } = await db.from('insights_cache')
    .select('content').eq('cache_key', cacheKey).single();
  if (cached && !body.noCache) {
    return NextResponse.json({ result: JSON.parse(cached.content), cached: true });
  }

  // ── 构建给 AI 的数据：每个地域传所有维度的 TOP3，含全国对比 ──
  const areaLines = (areaStats as {
    area: string; n: number;
    dims: Record<string, { label: string; pct: number; diff: number }[]>;
  }[]).map(a => {
    const dimLines = (dims as { key: string; label: string }[]).map(d => {
      const items = a.dims[d.key] ?? [];
      if (!items.length) return null;
      const natItems = (nationalTops as Record<string, { label: string; pct: number }[]>)[d.key] ?? [];
      // 传入 TOP3，含全国对比
      const itemStr = items.map(item => {
        const nat = natItems.find(n => n.label === item.label);
        const diffStr = item.diff > 5 ? `↑${item.diff}%高于全国` : item.diff < -5 ? `↓${Math.abs(item.diff)}%低于全国` : '';
        return `${item.label}${item.pct}%${diffStr ? `(${diffStr})` : ''}`;
      }).join('、');
      return `  ${d.label}：${itemStr}`;
    }).filter(Boolean).join('\n');
    return `【${a.area}，n=${a.n}】\n${dimLines}`;
  }).join('\n\n');

  const natSummary = (dims as { key: string; label: string }[]).map(d => {
    const items = (nationalTops as Record<string, { label: string; pct: number }[]>)[d.key] ?? [];
    return `${d.label}：${items.map(i => `${i.label}${i.pct}%`).join('、')}`;
  }).join('；');

  const regionLabel = regionType === 'city' ? '城市' : regionType === 'province' ? '省份' : '大区';
  const orderLabel  = orderStatus === 'all' ? '全部用户' : `${orderStatus}用户`;

  const prompt =
`你是华境S汽车品牌的用户研究专家，为各${regionLabel}生成用户画像简述。
当前分析对象：${orderLabel}

【全国均值参考】
${natSummary}

【各${regionLabel}详细数据】
${areaLines}

【输出要求】
为每个${regionLabel}，按照以下7个固定维度，各写一段简短的描述性词语。

【描述规则——严格遵守】
- 只用描述性词语，不写数字和百分比
- 每条控制在5-12字，是短语而非完整句子
- 参考示例（严格照此风格）：
  职业：公职人员和白领为主
  年龄：主力年龄为35-44岁
  学历：本科为主，学历偏中等
  收入：家庭年收入15-19万为主
  家庭结构：四口之家为主，多代同堂特征明显
  消费观念：务实型为主，注重性价比
  对比车型：主要与吉利银河M9、零跑D19对比
- 如样本不足30人，在"职业"字段开头加"小样本，"

严格按此JSON格式返回，不输出其他内容：
{
  "areas": {
    "${(areaStats as { area: string }[])[0]?.area ?? '地域名'}": {
      "职业": "描述",
      "年龄": "描述",
      "学历": "描述",
      "收入": "描述",
      "家庭结构": "描述",
      "消费观念": "描述",
      "对比车型": "描述"
    }
  }
}`
  const raw = await chat(prompt);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 返回格式错误');

  let result;
  try {
    result = JSON.parse(m[0]);
  } catch {
    // 尝试修复末尾逗号
    const fixed = m[0].replace(/,(\s*[}\]])/g, '$1');
    result = JSON.parse(fixed);
  }

  await db.from('insights_cache').upsert({
    cache_key: cacheKey,
    insight_type: 'area_portrait',
    content: JSON.stringify(result),
    generated_at: new Date().toISOString(),
  }, { onConflict: 'cache_key' });

  return NextResponse.json({ result, cached: false });
}
