export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS precio_tiers (
      id            SERIAL PRIMARY KEY,
      min_qty       INT NOT NULL,
      descuento_pct NUMERIC(5,2) NOT NULL,
      etiqueta      TEXT NOT NULL DEFAULT 'Mayorista',
      activo        BOOLEAN NOT NULL DEFAULT true,
      creado_en     TIMESTAMPTZ DEFAULT now()
    )
  `);
}

export async function GET() {
  await ensureTable();
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT id, min_qty, descuento_pct::float, etiqueta, activo
     FROM precio_tiers WHERE activo = true ORDER BY min_qty ASC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const { min_qty, descuento_pct, etiqueta } = await req.json();
  if (!min_qty || !descuento_pct) return NextResponse.json({ error: "min_qty y descuento_pct requeridos" }, { status: 400 });
  const rows = await (prisma as any).$queryRawUnsafe(
    `INSERT INTO precio_tiers (min_qty, descuento_pct, etiqueta)
     VALUES ($1, $2, $3) RETURNING id, min_qty, descuento_pct::float, etiqueta, activo`,
    Number(min_qty), Number(descuento_pct), etiqueta ?? "Mayorista"
  );
  return NextResponse.json(rows[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const { id, min_qty, descuento_pct, etiqueta, activo } = await req.json();
  await (prisma as any).$executeRawUnsafe(
    `UPDATE precio_tiers SET min_qty = COALESCE($2, min_qty),
      descuento_pct = COALESCE($3, descuento_pct),
      etiqueta = COALESCE($4, etiqueta),
      activo = COALESCE($5, activo)
     WHERE id = $1`,
    id, min_qty ?? null, descuento_pct ?? null, etiqueta ?? null, activo ?? null
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const { id } = await req.json();
  await (prisma as any).$executeRawUnsafe(`DELETE FROM precio_tiers WHERE id = $1`, id);
  return NextResponse.json({ ok: true });
}
