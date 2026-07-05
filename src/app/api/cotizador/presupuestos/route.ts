export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

const ESTADOS = ["borrador", "enviado", "aceptado", "rechazado"];

// Lista los presupuestos guardados (más nuevos primero).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    await ensureSchema("cotizador");
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM presupuestos ORDER BY creado_en DESC LIMIT 200`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// Guarda un presupuesto nuevo.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const b = await req.json();
  if (!Array.isArray(b?.items) || b.items.length === 0) {
    return NextResponse.json({ error: "El presupuesto no tiene ítems" }, { status: 400 });
  }
  try {
    await ensureSchema("cotizador");
    const rows = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO presupuestos
         (cliente_nombre, cliente_empresa, canal, medio_pago, items, subtotal, descuento_pct, total, notas)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9) RETURNING *`,
      b.cliente_nombre?.trim() || null, b.cliente_empresa?.trim() || null,
      b.canal === "mayorista" ? "mayorista" : "minorista", b.medio_pago || null,
      JSON.stringify(b.items), Number(b.subtotal) || 0, Number(b.descuento_pct) || 0,
      Number(b.total) || 0, b.notas?.trim() || null
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// Cambia el estado (o las notas) de un presupuesto.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const b = await req.json();
  if (!b?.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const estado = ESTADOS.includes(b.estado) ? b.estado : undefined;
  try {
    await ensureSchema("cotizador");
    const rows = await (prisma as any).$queryRawUnsafe(
      `UPDATE presupuestos SET
         estado = COALESCE($2, estado),
         notas = COALESCE($3, notas),
         actualizado_en = now()
       WHERE id = $1 RETURNING *`,
      Number(b.id), estado ?? null, b.notas ?? null
    );
    return NextResponse.json(rows[0] ?? null);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// Elimina un presupuesto.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await ensureSchema("cotizador");
    await (prisma as any).$executeRawUnsafe(`DELETE FROM presupuestos WHERE id = $1`, Number(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
