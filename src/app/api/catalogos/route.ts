export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS catalog_config (
      id      SERIAL PRIMARY KEY,
      tipo    TEXT NOT NULL UNIQUE,
      config  JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    await ensureTable();
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT tipo, config FROM catalog_config`
    );
    const result: Record<string, any> = {};
    for (const r of rows) result[r.tipo] = r.config;
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { tipo, config } = await req.json();
  if (!tipo) return NextResponse.json({ error: "tipo requerido" }, { status: 400 });
  try {
    await ensureTable();
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO catalog_config (tipo, config)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()
    `, tipo, JSON.stringify(config));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
