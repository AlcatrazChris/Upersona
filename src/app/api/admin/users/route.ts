import { NextResponse } from 'next/server';
// 此路由已迁移到 /api/admin/accounts
export async function GET()   { return NextResponse.json({ error: 'Moved to /api/admin/accounts' }, { status: 410 }); }
export async function PATCH() { return NextResponse.json({ error: 'Moved to /api/admin/accounts' }, { status: 410 }); }
