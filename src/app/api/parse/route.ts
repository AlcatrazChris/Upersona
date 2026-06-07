import { NextRequest, NextResponse } from 'next/server';
import { parseFileToDataset } from '@/lib/dataParser';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'json'].includes(ext ?? '')) {
      return NextResponse.json({ error: `不支持的文件格式：.${ext}` }, { status: 400 });
    }

    const buffer  = await file.arrayBuffer();
    const dataset = parseFileToDataset(buffer, file.name, { maxRows: 10000 });

    return NextResponse.json(dataset);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '解析失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
