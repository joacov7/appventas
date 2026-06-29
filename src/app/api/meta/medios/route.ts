export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const tipo = req.nextUrl.searchParams.get("tipo");
    const rows = await (prisma as any).$queryRawUnsafe(`
      SELECT * FROM meta_medios
      ${tipo ? "WHERE tipo = $1" : ""}
      ORDER BY creado_en DESC LIMIT 200
    `, ...(tipo ? [tipo] : []));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { nombre, tipo, url, etiquetas, tamanio_bytes } = await req.json();
    if (!nombre || !url) return NextResponse.json({ error: "nombre y url requeridos" }, { status: 400 });
    const rows = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_medios (nombre, tipo, url, etiquetas, tamanio_bytes)
      VALUES ($1,$2,$3,$4::text[],$5) RETURNING *
    `, nombre, tipo ?? "imagen", url,
       `{${(etiquetas ?? []).map((t: string) => `"${t}"`).join(",")}}`,
       tamanio_bytes ? Number(tamanio_bytes) : null);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { id } = await req.json();
    await (prisma as any).$executeRawUnsafe(`DELETE FROM meta_medios WHERE id = $1`, Number(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
