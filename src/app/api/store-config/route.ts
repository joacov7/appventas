export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const KEY = "store_config";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS catalog_config (
      tipo TEXT PRIMARY KEY,
      config JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, KEY
    );
    return NextResponse.json(rows[0]?.config ?? {});
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = await req.json();
  try {
    await ensureTable();
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO catalog_config (tipo, config)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()
    `, KEY, JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
