export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT id, tipo, min_qty, min_monto::float, descuento_pct::float, etiqueta, activo
       FROM precio_tiers WHERE activo = true ORDER BY COALESCE(min_qty,0) ASC, COALESCE(min_monto,0) ASC`
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { tipo, min_qty, min_monto, descuento_pct, etiqueta } = await req.json();
  if (!descuento_pct) return NextResponse.json({ error: "descuento_pct requerido" }, { status: 400 });
  if (tipo === "monto" && !min_monto) return NextResponse.json({ error: "min_monto requerido para tipo monto" }, { status: 400 });
  if (tipo !== "monto" && !min_qty) return NextResponse.json({ error: "min_qty requerido para tipo cantidad" }, { status: 400 });
  try {
    const rows = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO precio_tiers (tipo, min_qty, min_monto, descuento_pct, etiqueta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tipo, min_qty, min_monto::float, descuento_pct::float, etiqueta, activo`,
      tipo ?? "cantidad",
      tipo === "monto" ? null : Number(min_qty),
      tipo === "monto" ? Number(min_monto) : null,
      Number(descuento_pct),
      etiqueta ?? (tipo === "monto" ? "Descuento por monto" : "Mayorista")
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id, min_qty, min_monto, descuento_pct, etiqueta, activo } = await req.json();
  try {
    await (prisma as any).$executeRawUnsafe(
      `UPDATE precio_tiers SET
        min_qty = COALESCE($2, min_qty),
        min_monto = COALESCE($3, min_monto),
        descuento_pct = COALESCE($4, descuento_pct),
        etiqueta = COALESCE($5, etiqueta),
        activo = COALESCE($6, activo)
       WHERE id = $1`,
      id, min_qty ?? null, min_monto ?? null, descuento_pct ?? null, etiqueta ?? null, activo ?? null
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await req.json();
  try {
    await (prisma as any).$executeRawUnsafe(`DELETE FROM precio_tiers WHERE id = $1`, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
