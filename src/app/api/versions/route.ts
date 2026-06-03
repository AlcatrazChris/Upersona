import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET: 获取版本列表（公开）
export async function GET() {
  const db = createServiceClient();
  const { data, error } = await db
    .from('data_versions')
    .select('version_id, uploaded_at, record_count, is_active, notes')
    .order('version_id', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json((data || []).map(v => ({ ...v, version_name: v.notes })));
}

// PUT: 修改版本名称（admin only，使用 notes 字段承载显示名称）
export async function PUT(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const versionId = body.versionId as number | undefined;
  const versionName = typeof body.versionName === 'string' ? body.versionName.trim() : '';

  if (!versionId) {
    return NextResponse.json({ error: '缺少 versionId' }, { status: 400 });
  }
  if (versionName.length > 60) {
    return NextResponse.json({ error: '版本名称不能超过 60 个字符' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from('data_versions')
    .update({ notes: versionName || null })
    .eq('version_id', versionId)
    .select('version_id, uploaded_at, record_count, is_active, notes')
    .single();

  if (error) return NextResponse.json({ error: `保存版本名称失败: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: '版本不存在' }, { status: 404 });

  return NextResponse.json({ ...data, version_name: data.notes });
}

// DELETE: 删除历史版本（admin only，不能删除当前活跃版本）
export async function DELETE(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const versionId = body.versionId as number | undefined;

  if (!versionId) {
    return NextResponse.json({ error: '缺少 versionId' }, { status: 400 });
  }

  const db = createServiceClient();

  // 确认版本存在 & 不是活跃版本
  const { data: ver } = await db
    .from('data_versions')
    .select('version_id, is_active')
    .eq('version_id', versionId)
    .single();

  if (!ver) return NextResponse.json({ error: '版本不存在' }, { status: 404 });
  if (ver.is_active) {
    return NextResponse.json({ error: '不能删除当前活跃版本，请先上传新数据激活新版本' }, { status: 400 });
  }

  // 删除用户数据（级联）
  const { error: userErr } = await db.from('users').delete().eq('data_version', versionId);
  if (userErr) return NextResponse.json({ error: `删除用户数据失败: ${userErr.message}` }, { status: 500 });

  // 删除版本记录
  const { error: verErr } = await db.from('data_versions').delete().eq('version_id', versionId);
  if (verErr) return NextResponse.json({ error: `删除版本失败: ${verErr.message}` }, { status: 500 });

  // 清除该版本对应的 AI 缓存
  await db.from('insights_cache').delete().eq('data_version', versionId);

  return NextResponse.json({ success: true, deletedVersionId: versionId });
}
