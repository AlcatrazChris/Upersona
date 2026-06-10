/**
 * /api/datasets/[id]
 *
 * GET    — 拉取指定数据集（含全量记录，重组 chunks）
 *          需要已登录会话
 *
 * PATCH  — 更新字段 schema（字段名/类型/顺序/删除字段）
 *          仅 admin
 *
 * DELETE — 软删除（is_active = false）或彻底删除
 *          仅 admin
 */

import { NextResponse }  from 'next/server';
import { cookies }       from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth-server';
import { getSupabaseAdmin }         from '@/lib/supabase';
import type { Field }               from '@/types/dataSchema';

// ── 鉴权辅助 ─────────────────────────────────────────────────────

async function requireSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyToken(token);
}

async function requireAdmin() {
  const user = await requireSession();
  return user?.role === 'admin' ? user : null;
}

// ── GET /api/datasets/[id] ────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await requireSession())) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const sb = getSupabaseAdmin();
    const { id } = params;

    // 元信息
    const { data: ds, error: dsErr } = await sb
      .from('upersona_datasets')
      .select('id, name, source_type, row_count, fields, created_at, updated_at, uploaded_by')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (dsErr || !ds) {
      return NextResponse.json({ error: '数据集不存在' }, { status: 404 });
    }

    // 所有 chunks，按 chunk_index 升序
    const { data: chunks, error: cErr } = await sb
      .from('upersona_dataset_chunks')
      .select('chunk_index, rows')
      .eq('dataset_id', id)
      .order('chunk_index', { ascending: true });

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    // 重组记录
    const records: Record<string, unknown>[] = [];
    for (const c of (chunks ?? [])) {
      const rows = c.rows as Record<string, unknown>[];
      records.push(...rows);
    }

    // 拉取配置（可选）
    const { data: cfg } = await sb
      .from('upersona_dataset_configs')
      .select('view_config, persona_configs, saved_charts, canvas_elements')
      .eq('dataset_id', id)
      .single();

    return NextResponse.json({
      dataset: {
        id:        ds.id,
        name:      ds.name,
        source:    'supabase' as const,
        createdAt: ds.created_at,
        updatedAt: ds.updated_at,
        rowCount:  records.length,
        fields:    ds.fields as Field[],
        records,
      },
      config: cfg ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '服务器内部错误';
    console.error('[datasets/[id] GET]', e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

// ── PATCH /api/datasets/[id] ──────────────────────────────────────

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: '仅管理员可修改数据集' }, { status: 403 });
    }

    let body: { fields?: Field[] };
    try { body = await req.json() as typeof body; } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.fields) patch.fields = body.fields;

    const { error } = await sb
      .from('upersona_datasets')
      .update(patch)
      .eq('id', params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '服务器内部错误';
    console.error('[datasets/[id] PATCH]', e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

// ── DELETE /api/datasets/[id] ─────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: '仅管理员可删除数据集' }, { status: 403 });
    }

    const url     = new URL(req.url);
    const hardDel = url.searchParams.get('hard') === '1';
    const sb      = getSupabaseAdmin();

    if (hardDel) {
      // 彻底删除（级联删除 chunks + configs）
      const { error } = await sb.from('upersona_datasets').delete().eq('id', params.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // 软删除
      const { error } = await sb
        .from('upersona_datasets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', params.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '服务器内部错误';
    console.error('[datasets/[id] DELETE]', e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
