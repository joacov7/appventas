export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { campana_id, nombre, pais, provincia, ciudad, edad_min, edad_max, sexo, idiomas, intereses, comportamientos, publicos_personalizados, publicos_similares, presupuesto_diario } = await req.json();
    if (!campana_id || !nombre) return NextResponse.json({ error: "campana_id y nombre requeridos" }, { status: 400 });
    const rows = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_conjuntos (campana_id, nombre, pais, provincia, ciudad, edad_min, edad_max, sexo, idiomas, intereses, comportamientos, publicos_personalizados, publicos_similares, presupuesto_diario)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14)
      RETURNING *
    `, Number(campana_id), nombre, pais ?? "AR", provincia ?? null, ciudad ?? null,
       edad_min ?? 18, edad_max ?? 65, sexo ?? "todos",
       JSON.stringify(idiomas ?? ["es"]),
       JSON.stringify(intereses ?? []),
       JSON.stringify(comportamientos ?? []),
       JSON.stringify(publicos_personalizados ?? []),
       JSON.stringify(publicos_similares ?? []),
       presupuesto_diario ? Number(presupuesto_diario) : null);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { id, ...body } = await req.json();
    const fields = ["nombre","pais","provincia","ciudad","edad_min","edad_max","sexo","presupuesto_diario"];
    const jsonFields = ["idiomas","intereses","comportamientos","publicos_personalizados","publicos_similares"];
    const updates: string[] = [];
    const vals: any[] = [id];
    let i = 2;
    for (const f of fields) { if (f in body) { updates.push(`${f} = $${i++}`); vals.push(body[f]); } }
    for (const f of jsonFields) { if (f in body) { updates.push(`${f} = $${i++}::jsonb`); vals.push(JSON.stringify(body[f])); } }
    if (updates.length) {
      await (prisma as any).$executeRawUnsafe(`UPDATE meta_conjuntos SET ${updates.join(", ")} WHERE id = $1`, ...vals);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { id } = await req.json();
    await (prisma as any).$executeRawUnsafe(`DELETE FROM meta_conjuntos WHERE id = $1`, Number(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
