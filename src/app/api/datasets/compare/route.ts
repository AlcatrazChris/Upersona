/**
 * POST /api/datasets/compare
 * 比较两个 Dataset 的 Schema，返回字段变化报告。
 *
 * Body: { oldFields: Field[], newFields: Field[] }
 * Response: FieldDiff
 */

import { NextRequest, NextResponse } from 'next/server';
import { compareSchemas } from '@/lib/schemaDetector';
import type { Field } from '@/types/dataSchema';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { oldFields: Field[]; newFields: Field[] };
    if (!Array.isArray(body.oldFields) || !Array.isArray(body.newFields)) {
      return NextResponse.json({ error: 'oldFields 和 newFields 必须为数组' }, { status: 400 });
    }
    const diff = compareSchemas(body.oldFields, body.newFields);
    return NextResponse.json(diff);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '比较失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
