import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getPrompt } from '@/lib/deepseek';
import { DEFAULT_AREA_PORTRAIT_PROMPT } from '@/lib/prompt-defaults';

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
  const areaKey  = (areaStats as { area: string; n: number }[]).map(a => `${a.area}-${a.n}`).join(',');
  const cacheKey = `area_portrait_v2:${orderStatus}:${regionType || 'area'}:${areaKey}`;

  const db = createServiceClient();
  const { data: cached } = await db.from('insights_cache')
    .select('content').eq('cache_key', cacheKey).single();
  if (cached && !body.noCache) {
    return NextResponse.json({ result: JSON.parse(cached.content), cached: true, cacheKey });
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
      const itemStr = items.map(item => {
        const nat = natItems.find(n => n.label === item.label);
        void nat; // available if needed for diff text
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

  // 从数据库读取 prompt（管理员可在后台修改），替换占位符
  const template = await getPrompt('area_portrait', DEFAULT_AREA_PORTRAIT_PROMPT);
  const prompt = template
    .replace(/\{regionLabel\}/g, regionLabel)
    .replace(/\{orderLabel\}/g, orderLabel)
    .replace('{natSummary}', natSummary)
    .replace('{areaLines}', areaLines);

  const raw = await chat(prompt);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 返回格式错误');

  let result;
  try {
    result = JSON.parse(m[0]);
  } catch {
    const fixed = m[0].replace(/,(\s*[}\]])/g, '$1');
    result = JSON.parse(fixed);
  }

  // 获取活跃版本号用于缓存标记
  const { data: vd } = await db.from('data_versions').select('version_id')
    .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();

  await db.from('insights_cache').upsert({
    cache_key:    cacheKey,
    insight_type: 'area_portrait',
    content:      JSON.stringify(result),
    data_version: vd?.version_id ?? 0,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'cache_key' });

  return NextResponse.json({ result, cached: false, cacheKey });
}
