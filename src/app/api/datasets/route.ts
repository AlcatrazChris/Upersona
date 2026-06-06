/**
 * POST /api/datasets
 * 通用数据集上传接口：接受 xlsx / xls / csv / json 文件，
 * 返回自动识别的 Dataset（含字段 Schema，不含完整 records，
 * 完整数据通过 /api/datasets/[id] 或直接在客户端解析获取）。
 *
 * 注：当前实现为无状态解析（不持久化到 DB），
 * 返回完整 Dataset 供客户端 Zustand Store 存储。
 * 未来可扩展为持久化到 Supabase datasets 表。
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseFileToDataset } from '@/lib/dataParser';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

/** 文件大小限制：20 MB */
const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const sheetName = formData.get('sheetName') as string | null;
    const maxRowsRaw = formData.get('maxRows') as string | null;

    if (!file) {
      return NextResponse.json({ error: '未找到上传文件' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `文件过大（最大 20MB，当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` },
        { status: 413 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowed = ['xlsx', 'xls', 'csv', 'json'];
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件格式 .${ext}，请上传 Excel、CSV 或 JSON 文件` },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const dataset = parseFileToDataset(buffer, file.name, {
      name: name ?? undefined,
      sheetName: sheetName ?? undefined,
      maxRows: maxRowsRaw ? parseInt(maxRowsRaw, 10) : 50_000,
    });

    // 返回完整 Dataset（含 records，客户端存入 Zustand）
    return NextResponse.json(dataset);

  } catch (err) {
    const msg = err instanceof Error ? err.message : '解析失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/datasets — 返回空列表占位（数据存在客户端） */
export async function GET() {
  return NextResponse.json({ message: '数据集存储在客户端 Zustand Store 中', datasets: [] });
}
