export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

async function ensureTable() {
  await ensureSchema("fabricantes");
}

// Normaliza y acota los campos numéricos de reglas de precio.
function num(v: any, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Lista fabricantes con cuántos productos tiene asociados cada uno.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    await ensureTable();
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT f.*, COUNT(pf.product_id)::int AS productos
       FROM fabricantes f
       LEFT JOIN producto_fabricante pf ON pf.fabricante_id = f.id
       GROUP BY f.id
       ORDER BY f.activo DESC, f.nombre ASC`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// Alta o edición de un fabricante (upsert por id si viene).
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const b = await req.json();
  if (!b?.nombre?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  try {
    await ensureTable();
    const campos = {
      nombre: String(b.nombre).trim(),
      contacto_nombre: b.contacto_nombre?.trim() || null,
      whatsapp: b.whatsapp?.trim() || null,
      email: b.email?.trim() || null,
      sitio_web: b.sitio_web?.trim() || null,
      margen_pct: num(b.margen_pct),
      descuento_b2b_pct: num(b.descuento_b2b_pct),
      recargo_medios_pago_pct: num(b.recargo_medios_pago_pct),
      moneda: b.moneda === "USD" ? "USD" : "ARS",
      notas: b.notas?.trim() || null,
      activo: b.activo !== false,
    };

    if (b.id) {
      const rows = await (prisma as any).$queryRawUnsafe(
        `UPDATE fabricantes SET
           nombre=$2, contacto_nombre=$3, whatsapp=$4, email=$5, sitio_web=$6,
           margen_pct=$7, descuento_b2b_pct=$8, recargo_medios_pago_pct=$9,
           moneda=$10, notas=$11, activo=$12, actualizado_en=now()
         WHERE id=$1 RETURNING *`,
        Number(b.id), campos.nombre, campos.contacto_nombre, campos.whatsapp, campos.email,
        campos.sitio_web, campos.margen_pct, campos.descuento_b2b_pct, campos.recargo_medios_pago_pct,
        campos.moneda, campos.notas, campos.activo
      );
      return NextResponse.json(rows[0]);
    }

    const rows = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO fabricantes
         (nombre, contacto_nombre, whatsapp, email, sitio_web,
          margen_pct, descuento_b2b_pct, recargo_medios_pago_pct, moneda, notas, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      campos.nombre, campos.contacto_nombre, campos.whatsapp, campos.email, campos.sitio_web,
      campos.margen_pct, campos.descuento_b2b_pct, campos.recargo_medios_pago_pct,
      campos.moneda, campos.notas, campos.activo
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// Baja de un fabricante (elimina también sus asociaciones por cascada).
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await ensureTable();
    await (prisma as any).$executeRawUnsafe(`DELETE FROM fabricantes WHERE id = $1`, Number(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
