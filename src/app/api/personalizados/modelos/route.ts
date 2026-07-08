export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

export async function GET() {
  // Lectura pública: sirve para el mockup (y a futuro para el cliente).
  try {
    await ensureSchema("personalizados");
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT id, nombre, categoria, imagen_url, activo FROM modelos_personalizados
       WHERE activo = true ORDER BY orden ASC, categoria, nombre`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const b = await req.json();
  if (!b?.nombre?.trim() || !b?.imagen_url?.trim())
    return NextResponse.json({ error: "Nombre e imagen son obligatorios" }, { status: 400 });
  try {
    await ensureSchema("personalizados");
    const rows = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO modelos_personalizados (nombre, categoria, imagen_url, orden)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      b.nombre.trim(), b.categoria || "mate", b.imagen_url.trim(), Number(b.orden) || 0
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await ensureSchema("personalizados");
    await (prisma as any).$executeRawUnsafe(`DELETE FROM modelos_personalizados WHERE id = $1`, Number(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
