export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { conjunto_id, campana_id, nombre, formato, imagenes, video_url, texto_principal, titulo, descripcion, cta, url_destino, whatsapp, instagram, facebook } = await req.json();
    if (!conjunto_id || !campana_id || !nombre) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const rows = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_anuncios (conjunto_id, campana_id, nombre, formato, imagenes, video_url, texto_principal, titulo, descripcion, cta, url_destino, whatsapp, instagram, facebook)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, Number(conjunto_id), Number(campana_id), nombre, formato ?? "imagen",
       JSON.stringify(imagenes ?? []), video_url ?? null,
       texto_principal ?? null, titulo ?? null, descripcion ?? null,
       cta ?? "LEARN_MORE", url_destino ?? null,
       whatsapp ?? null, instagram ?? null, facebook ?? null);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { id, ...body } = await req.json();
    const fields = ["nombre","formato","video_url","texto_principal","titulo","descripcion","cta","url_destino","whatsapp","instagram","facebook","activo"];
    const updates: string[] = [];
    const vals: any[] = [id];
    let i = 2;
    for (const f of fields) { if (f in body) { updates.push(`${f} = $${i++}`); vals.push(body[f]); } }
    if ("imagenes" in body) { updates.push(`imagenes = $${i++}::jsonb`); vals.push(JSON.stringify(body.imagenes)); }
    if (updates.length) await (prisma as any).$executeRawUnsafe(`UPDATE meta_anuncios SET ${updates.join(", ")} WHERE id = $1`, ...vals);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { id } = await req.json();
    await (prisma as any).$executeRawUnsafe(`DELETE FROM meta_anuncios WHERE id = $1`, Number(id));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
