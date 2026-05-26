import { NextRequest, NextResponse } from 'next/server';
import { generateStatusInsight } from '@/lib/deepseek';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const insight = await generateStatusInsight(body);
    return NextResponse.json({ insight });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
