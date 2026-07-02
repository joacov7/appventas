export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const id = Number((await params).id);
    const [campana, conjuntos, metricas] = await Promise.all([
      (prisma as any).$queryRawUnsafe(`SELECT * FROM meta_campanas WHERE id = $1`, id),
      (prisma as any).$queryRawUnsafe(`
        SELECT cs.*, COALESCE(json_agg(a.*) FILTER (WHERE a.id IS NOT NULL), '[]') AS anuncios
        FROM meta_conjuntos cs
        LEFT JOIN meta_anuncios a ON a.conjunto_id = cs.id
        WHERE cs.campana_id = $1
        GROUP BY cs.id ORDER BY cs.creado_en ASC
      `, id),
      (prisma as any).$queryRawUnsafe(`
        SELECT * FROM meta_metricas WHERE campana_id = $1 ORDER BY fecha DESC LIMIT 30
      `, id),
    ]);
    if (!campana[0]) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json({ ...campana[0], conjuntos, metricas });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const id = Number((await params).id);
    const body = await req.json();
    const fields = ["nombre","estado","objetivo","fecha_inicio","fecha_fin","presupuesto_diario","presupuesto_total","notas"];
    const updates = fields.filter(f => f in body);
    if (!updates.length) return NextResponse.json({ ok: true });
    const set = updates.map((f, i) => `${f} = $${i + 2}`).join(", ");
    const vals = updates.map(f => body[f]);
    await (prisma as any).$executeRawUnsafe(
      `UPDATE meta_campanas SET ${set}, actualizado_en = NOW() WHERE id = $1`,
      id, ...vals
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    await (prisma as any).$executeRawUnsafe(`DELETE FROM meta_campanas WHERE id = $1`, Number((await params).id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
