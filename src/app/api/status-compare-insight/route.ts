import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';
import { generateStatusInsight, getPrompt } from '@/lib/deepseek';
import { DEFAULT_OVERVIEW_INSIGHT_PROMPT } from '@/lib/prompt-defaults';

// 概览洞察：基于各维度 TOP 数据生成整体差异分析
async function generateOverviewInsight(dimsData: {
  dimLabel: string;
  rows: Record<string, string | number>[];
}[]): Promise<string> {
  const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
  const summaryLines = dimsData.map(d => {
    const topRows = d.rows.slice(0, 4);
    const rowStr = topRows.map(r => {
      const locked  = Number(r['锁单/提车'] ?? 0).toFixed(0);
      const pending = Number(r['未锁单']    ?? 0).toFixed(0);
      const cancel  = Number(r['退单']      ?? 0).toFixed(0);
      return `  ${r.label}：锁单${locked}% / 未锁单${pending}% / 退单${cancel}%`;
    }).join('\n');
    return `【${d.dimLabel}】\n${rowStr}`;
  }).join('\n\n');

  const template = await getPrompt('overview_insight', DEFAULT_OVERVIEW_INSIGHT_PROMPT);
  const prompt = template.replace('{summaryLines}', summaryLines);

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.65, max_tokens: 600 }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

export const dynamic = 'force-dynamic';

const OVERVIEW_CACHE_KEY = 'status_insight:overview:global';

function makeCacheKey(body: Record<string, unknown>): string {
  const { dimensionLabel, filter, rows, isOverview } = body as {
    dimensionLabel: string; filter: string;
    rows: { label: string }[];
    isOverview?: boolean;
  };
  if (isOverview) return OVERVIEW_CACHE_KEY;
  return `status_insight:${dimensionLabel}:${filter}:${(rows ?? []).map(r => r.label).join(',')}`;
}

type StoredContent = { ai: string; custom?: string; prefer?: 'ai' | 'custom' };

function parseContent(raw: string): StoredContent {
  try { return JSON.parse(raw) as StoredContent; }
  catch { return { ai: raw }; }
}

function buildResponse(stored: StoredContent, extra?: Record<string, unknown>) {
  const displayText = (stored.prefer === 'custom' && stored.custom)
    ? stored.custom
    : (stored.ai || null);
  return {
    insight: stored.ai || null,
    custom:  stored.custom ?? null,
    prefer:  stored.prefer ?? 'ai',
    displayText,
    ...extra,
  };
}

// GET：读取缓存，直接返回，不管有没有内容
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isOverview = searchParams.get('isOverview') === '1';
  const key = isOverview
    ? OVERVIEW_CACHE_KEY
    : searchParams.get('cacheKey') ?? '';

  if (!key) return NextResponse.json(buildResponse({ ai: '' }));

  const db = createServiceClient();
  const { data } = await db.from('insights_cache')
    .select('content').eq('cache_key', key).single();

  if (!data) return NextResponse.json(buildResponse({ ai: '' }, { cached: false }));
  return NextResponse.json(buildResponse(parseContent(data.content), { cached: true }));
}

export async function POST(req: NextRequest) {
  const body    = await req.json();
  const db      = createServiceClient();
  const cacheKey = makeCacheKey(body);

  const { forceRegenerate, saveCustom, customText, savePrefer, prefer, isOverview } = body as {
    forceRegenerate?: boolean; saveCustom?: boolean; customText?: string;
    savePrefer?: boolean; prefer?: 'ai' | 'custom'; isOverview?: boolean;
  };

  async function getExisting(): Promise<StoredContent> {
    const { data } = await db.from('insights_cache')
      .select('content').eq('cache_key', cacheKey).single();
    return data ? parseContent(data.content) : { ai: '' };
  }

  async function upsert(stored: StoredContent) {
    await db.from('insights_cache').upsert({
      cache_key: cacheKey,
      insight_type: 'status_insight',
      content: JSON.stringify(stored),
      data_version: 0,            // 0 = 非数据版本绑定（概览 / 自定义内容专用）
      generated_at: new Date().toISOString(),
    }, { onConflict: 'cache_key' });
  }

  // ── 概览模式 ──
  if (isOverview) {
    if (savePrefer) {
      if (!requireAdmin()) return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
      const stored = await getExisting();
      stored.prefer = prefer ?? 'ai';
      await upsert(stored);
      return NextResponse.json(buildResponse(stored));
    }
    if (saveCustom) {
      if (!requireAdmin()) return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
      const stored = await getExisting();
      stored.custom = customText ?? '';
      stored.prefer = 'custom'; // 保存自定义时自动切换为显示自定义
      await upsert(stored);
      return NextResponse.json(buildResponse(stored));
    }
    // 读缓存（非强制重新生成）
    if (!forceRegenerate) {
      const { data: cached } = await db.from('insights_cache')
        .select('content').eq('cache_key', cacheKey).single();
      if (cached) {
        return NextResponse.json(buildResponse(parseContent(cached.content), { cached: true }));
      }
    }
    // forceRegenerate=true 时：需要管理员权限，先检查 prefer 配置，custom 模式下不调用 DeepSeek
    if (!requireAdmin()) return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    const existingOverview = await getExisting();
    if (existingOverview.prefer === 'custom' && existingOverview.custom) {
      return NextResponse.json(buildResponse(existingOverview, { cached: true, skipped: 'custom_mode' }));
    }
    // 生成概览 AI 洞察：用动态维度配置
    try {
      const { fetchUsers } = await import('@/lib/supabase');
      const { getProfileDimensions, getDimensionColumns } = await import('@/lib/dimensions');
      const { countDimension, sortLabels } = await import('@/lib/sample-counter');

      const profileDims = await getProfileDimensions(db);

      const { data: vd } = await db.from('data_versions').select('version_id')
        .eq('is_active', true).order('version_id', { ascending: false }).limit(1).single();
      if (!vd) throw new Error('无活跃数据版本');

      const STATUS_GROUPS = [
        { key: '锁单/提车', values: ['已锁单','订单完成'] },
        { key: '未锁单',    values: ['未锁单'] },
        { key: '退单',      values: ['退单'] },
      ];

      const cols  = getDimensionColumns(profileDims, ['order_status']);
      let users;
      try {
        users = await fetchUsers(db, cols, q => q.eq('data_version', vd.version_id));
      } catch {
        const safeCols = 'age_group,education,occupation_category,family_structure,annual_income,is_upgrade,order_status';
        users = await fetchUsers(db, safeCols, q => q.eq('data_version', vd.version_id));
      }

      const sgUsers = STATUS_GROUPS.map(sg => ({
        key: sg.key,
        users: users.filter((u: Record<string,unknown>) => sg.values.includes(String(u.order_status))),
      }));

      const dimsData = profileDims.map(dimConfig => {
        const dimKey = dimConfig.key as string;
        const cr = countDimension(users as Record<string,unknown>[], dimKey, dimConfig.isMultiSelect);
        if (Object.keys(cr.counter).length === 0) return null;
        const allLabels = sortLabels(Object.keys(cr.counter), cr.counter, dimConfig.isOrdered, dimConfig.orderedValues).slice(0, 5);
        const rows = allLabels.map(label => {
          const entry: Record<string,string|number> = { label };
          for (const sg of sgUsers) {
            const sgCr  = countDimension(sg.users, dimKey, dimConfig.isMultiSelect);
            const count = sgCr.counter[label] || 0;
            const denom = dimConfig.isMultiSelect ? sgCr.multiSelectDenom : sgCr.validUserCount;
            entry[sg.key] = denom > 0 ? parseFloat((count/denom*100).toFixed(1)) : 0;
          }
          return entry;
        });
        return { dimLabel: dimConfig.label, rows };
      }).filter((d): d is { dimLabel: string; rows: Record<string,string|number>[] } => d !== null);

      const insight = await generateOverviewInsight(dimsData);
      const stored  = await getExisting();
      stored.ai     = insight;
      await upsert(stored);
      return NextResponse.json(buildResponse(stored, { cached: false }));
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  // ── 普通维度模式 ──
  if (savePrefer) {
    if (!requireAdmin()) return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    const stored = await getExisting();
    stored.prefer = prefer ?? 'ai';
    await upsert(stored);
    return NextResponse.json(buildResponse(stored));
  }

  if (saveCustom) {
    if (!requireAdmin()) return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
    const stored = await getExisting();
    stored.custom = customText ?? '';
    stored.prefer = 'custom'; // 保存自定义时自动切换为显示自定义
    await upsert(stored);
    return NextResponse.json(buildResponse(stored));
  }

  // ── 读缓存（非强制重新生成时） ──
  if (!forceRegenerate) {
    const { data: cached } = await db.from('insights_cache')
      .select('content').eq('cache_key', cacheKey).single();
    if (cached) {
      return NextResponse.json(buildResponse(parseContent(cached.content), { cached: true }));
    }
    // cache miss → 任何用户均可触发首次生成（不需要管理员权限）
  }

  // ── 强制重新生成（已有缓存时）：仅管理员可操作 ──
  if (forceRegenerate && !requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  // ── 先检查 prefer 配置：自定义模式下不调用 DeepSeek ──
  const existingStored = await getExisting();
  if (existingStored.prefer === 'custom' && existingStored.custom) {
    return NextResponse.json(buildResponse(existingStored, { cached: true, skipped: 'custom_mode' }));
  }

  // ── 生成 AI 洞察 ──
  try {
    const insight = await generateStatusInsight(body);
    const stored  = await getExisting();
    stored.ai     = insight;
    if (!stored.prefer) stored.prefer = 'ai';
    await upsert(stored);
    return NextResponse.json(buildResponse(stored, { cached: false }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
