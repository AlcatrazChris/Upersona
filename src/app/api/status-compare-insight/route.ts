import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { generateStatusInsight } from '@/lib/deepseek';

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
  try {
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

    async function getActiveVersionId(): Promise<number> {
      const { data, error } = await db.from('data_versions')
        .select('version_id').eq('is_active', true)
        .order('version_id', { ascending: false }).limit(1).single();

      if (error || !data) {
        throw new Error(error?.message || '无活跃数据版本');
      }

      return data.version_id;
    }

    async function upsert(stored: StoredContent) {
      const versionId = await getActiveVersionId();
      const { error } = await db.from('insights_cache').upsert({
        cache_key: cacheKey,
        insight_type: 'status_insight',
        content: JSON.stringify(stored),
        data_version: versionId,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'cache_key' });

      if (error) throw new Error(error.message);
    }

    // ── 概览模式：只支持 saveCustom 和 savePrefer，不调用 AI ──
    if (isOverview) {
      if (savePrefer) {
        const stored = await getExisting();
        stored.prefer = prefer ?? 'ai';
        await upsert(stored);
        return NextResponse.json(buildResponse(stored));
      }
      if (saveCustom) {
        const stored = await getExisting();
        stored.custom = customText ?? '';
        if (stored.custom.trim()) stored.prefer = 'custom';
        await upsert(stored);
        return NextResponse.json(buildResponse(stored));
      }
      // 概览不支持 AI 生成（没有真实维度数据）
      const stored = await getExisting();
      return NextResponse.json(buildResponse(stored, { cached: true }));
    }

    // ── 普通维度模式 ──
    if (savePrefer) {
      const stored = await getExisting();
      stored.prefer = prefer ?? 'ai';
      await upsert(stored);
      return NextResponse.json(buildResponse(stored));
    }

    if (saveCustom) {
      const stored = await getExisting();
      stored.custom = customText ?? '';
      await upsert(stored);
      return NextResponse.json(buildResponse(stored));
    }

    // 读缓存
    if (!forceRegenerate) {
      const { data: cached } = await db.from('insights_cache')
        .select('content').eq('cache_key', cacheKey).single();
      if (cached) {
        return NextResponse.json(buildResponse(parseContent(cached.content), { cached: true }));
      }
    }

    // 生成 AI 洞察
    const insight = await generateStatusInsight(body);
    const stored  = await getExisting();
    stored.ai     = insight;
    await upsert(stored);
    return NextResponse.json(buildResponse(stored, { cached: false }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
