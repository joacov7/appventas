export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { searchParams } = req.nextUrl;
    const campana_id = searchParams.get("campana_id");
    const estado = searchParams.get("estado");
    const rows = await (prisma as any).$queryRawUnsafe(`
      SELECT l.*, c.nombre AS campana_nombre
      FROM meta_leads l
      LEFT JOIN meta_campanas c ON c.id = l.campana_id
      ${campana_id ? "WHERE l.campana_id = $1" : estado ? "WHERE l.estado = $1" : ""}
      ORDER BY l.creado_en DESC LIMIT 200
    `, ...(campana_id ? [Number(campana_id)] : estado ? [estado] : []));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { campana_id, nombre, email, telefono, pais, fuente, estado, valor_estimado, notas } = await req.json();
    const rows = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_leads (campana_id, nombre, email, telefono, pais, fuente, estado, valor_estimado, notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, campana_id ? Number(campana_id) : null, nombre ?? null, email ?? null, telefono ?? null,
       pais ?? "AR", fuente ?? "meta_ads", estado ?? "nuevo",
       valor_estimado ? Number(valor_estimado) : null, notas ?? null);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { id, ...body } = await req.json();
    const fields = ["nombre","email","telefono","pais","fuente","estado","valor_estimado","notas","campana_id"];
    const updates: string[] = [];
    const vals: any[] = [id];
    let i = 2;
    for (const f of fields) { if (f in body) { updates.push(`${f} = $${i++}`); vals.push(body[f]); } }
    if (updates.length) await (prisma as any).$executeRawUnsafe(`UPDATE meta_leads SET ${updates.join(", ")} WHERE id = $1`, ...vals);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { id } = await req.json();
    await (prisma as any).$executeRawUnsafe(`DELETE FROM meta_leads WHERE id = $1`, Number(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
