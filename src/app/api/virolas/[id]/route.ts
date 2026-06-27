export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function row(r: any) {
  return {
    id: Number(r.id),
    nombre: r.nombre,
    slug: r.slug,
    descripcion: r.descripcion,
    material: r.material,
    diametroMm: Number(r.diametro_mm),
    precioBase: r.precio_base,
    imageUrl: r.image_url,
    disenoBase: r.diseno_base ?? null,
    activa: r.activa,
    posicion: Number(r.posicion),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows: any[] = await (prisma as any).$queryRawUnsafe(`SELECT * FROM virolas WHERE id = $1`, Number(id));
  if (!rows[0]) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(row(rows[0]));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (body.nombre !== undefined)     { sets.push(`nombre=$${i++}`);      vals.push(body.nombre.trim()); }
  if (body.slug !== undefined)       { sets.push(`slug=$${i++}`);        vals.push(body.slug.trim().toLowerCase()); }
  if (body.descripcion !== undefined){ sets.push(`descripcion=$${i++}`); vals.push(body.descripcion); }
  if (body.material !== undefined)   { sets.push(`material=$${i++}`);    vals.push(body.material); }
  if (body.diametroMm !== undefined) { sets.push(`diametro_mm=$${i++}`); vals.push(Number(body.diametroMm)); }
  if (body.precioBase !== undefined) { sets.push(`precio_base=$${i++}`); vals.push(Number(body.precioBase)); }
  if (body.imageUrl !== undefined)   { sets.push(`image_url=$${i++}`);   vals.push(body.imageUrl); }
  if (body.disenoBase !== undefined) { sets.push(`diseno_base=$${i++}`); vals.push(body.disenoBase); }
  if (body.activa !== undefined)     { sets.push(`activa=$${i++}`);      vals.push(Boolean(body.activa)); }
  if (body.posicion !== undefined)   { sets.push(`posicion=$${i++}`);    vals.push(Number(body.posicion)); }

  if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  sets.push(`updated_at=NOW()`);
  vals.push(Number(id));

  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `UPDATE virolas SET ${sets.join(",")} WHERE id=$${i} RETURNING *`,
    ...vals
  );
  if (!rows[0]) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(row(rows[0]));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  await (prisma as any).$executeRawUnsafe(`DELETE FROM virolas WHERE id=$1`, Number(id));
  return NextResponse.json({ ok: true });
}
