/**
 * /api/datasets
 *
 * GET  — 列出所有已推送到 Supabase 的数据集（元信息，不含记录）
 *        需要已登录会话（viewer/admin 均可）
 *
 * POST — Admin 将本地数据集推送到 Supabase
 *        Body: { dataset: Dataset, viewConfig?, personaConfigs?, savedCharts?, canvasElements? }
 *        分块写入 upersona_dataset_chunks（每块 1000 行）
 */

import { NextResponse }  from 'next/server';
import { cookies }       from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth-server';
import { getSupabaseAdmin }         from '@/lib/supabase';
import type { Dataset, Field }      from '@/types/dataSchema';
import type { ViewConfig }          from '@/lib/viewConfig';

const CHUNK_SIZE = 1000;

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

// ── GET /api/datasets ─────────────────────────────────────────────

export async function GET() {
  try {
    if (!(await requireSession())) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('upersona_datasets')
      .select('id, name, source_type, row_count, fields, created_at, updated_at, uploaded_by')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      // 表未创建（migration 尚未执行）→ 静默返回空列表而非 500
      if (
        error.code === '42P01' ||
        (error.message ?? '').includes('does not exist') ||
        (error.message ?? '').includes('relation')
      ) {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (e) {
    // 环境变量缺失 / 其他启动异常 → 静默返回空列表，不暴露 500
    console.warn('[datasets GET] 数据库不可用:', e instanceof Error ? e.message : e);
    return NextResponse.json([]);
  }
}

// ── POST /api/datasets ────────────────────────────────────────────

export const maxDuration = 60; // allow slow uploads

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: '仅管理员可推送数据集' }, { status: 403 });

    let body: {
      dataset:         Dataset;
      viewConfig?:     ViewConfig;
      personaConfigs?: unknown;
      savedCharts?:    unknown;
      canvasElements?: unknown;
    };

    try {
      body = await req.json() as typeof body;
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    const { dataset, viewConfig, personaConfigs, savedCharts, canvasElements } = body;
    if (!dataset?.id || !dataset?.name || !Array.isArray(dataset.records)) {
      return NextResponse.json({ error: '数据集格式无效' }, { status: 400 });
    }

    // getSupabaseAdmin() 若 env 变量缺失会 throw，在外层 catch 中处理
    const sb = getSupabaseAdmin();

    // ── 1. 写入或覆盖 upersona_datasets ───────────────────────────

    const fieldsToSave: Field[] = dataset.fields;
    const { error: dsErr } = await sb
      .from('upersona_datasets')
      .upsert({
        id:          dataset.id,
        name:        dataset.name,
        source_type: dataset.source === 'supabase' ? 'xlsx' : dataset.source,
        row_count:   dataset.rowCount,
        fields:      fieldsToSave,
        uploaded_by: admin.username,
        updated_at:  new Date().toISOString(),
        is_active:   true,
      }, { onConflict: 'id' });

    if (dsErr) return NextResponse.json({ error: `写入数据集失败: ${dsErr.message}` }, { status: 500 });

    // ── 2. 删除旧的 chunks，重新写入 ──────────────────────────────

    await sb.from('upersona_dataset_chunks').delete().eq('dataset_id', dataset.id);

    const records = dataset.records;
    const chunkCount = Math.ceil(records.length / CHUNK_SIZE);

    for (let i = 0; i < chunkCount; i++) {
      const chunk = records.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const { error: cErr } = await sb
        .from('upersona_dataset_chunks')
        .insert({ dataset_id: dataset.id, chunk_index: i, rows: chunk });

      if (cErr) {
        return NextResponse.json(
          { error: `写入数据块 ${i} 失败: ${cErr.message}` },
          { status: 500 },
        );
      }
    }

    // ── 3. 写入配置 ────────────────────────────────────────────────

    const { error: cfgErr } = await sb
      .from('upersona_dataset_configs')
      .upsert({
        dataset_id:      dataset.id,
        view_config:     viewConfig     ?? {},
        persona_configs: personaConfigs ?? [],
        saved_charts:    savedCharts    ?? [],
        canvas_elements: canvasElements ?? [],
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'dataset_id' });

    if (cfgErr) {
      // 配置写入失败不阻断，仅记录警告
      console.warn('配置写入失败（非致命）:', cfgErr.message);
    }

    return NextResponse.json({
      ok:         true,
      id:         dataset.id,
      chunkCount,
      rowCount:   records.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '服务器内部错误';
    console.error('[datasets POST]', e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
