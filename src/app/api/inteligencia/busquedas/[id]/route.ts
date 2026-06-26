import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if ("activa" in body) { sets.push(`activa = $${idx++}`); vals.push(body.activa); }
  if ("umbral_alerta" in body) { sets.push(`umbral_alerta = $${idx++}`); vals.push(Number(body.umbral_alerta)); }

  if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  vals.push(Number(id));
  await (prisma as any).$executeRawUnsafe(
    `UPDATE busquedas_competidores SET ${sets.join(", ")} WHERE id = $${idx}`,
    ...vals
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { id } = await params;
  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM busquedas_competidores WHERE id = $1`, Number(id)
  );
  return NextResponse.json({ ok: true });
}
