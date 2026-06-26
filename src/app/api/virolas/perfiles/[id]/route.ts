import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(body)) {
    const col = { nombre: "nombre", material: "material", potencia: "potencia", velocidad: "velocidad", pasadas: "pasadas", notas: "notas", activo: "activo" }[k];
    if (col) { sets.push(`${col} = $${i++}`); vals.push(v); }
  }
  if (!sets.length) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  vals.push(Number(id));
  const rows = await (prisma as any).$queryRawUnsafe(
    `UPDATE perfiles_laser SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, ...vals
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  await (prisma as any).$executeRawUnsafe(`DELETE FROM perfiles_laser WHERE id = $1`, Number(id));
  return NextResponse.json({ ok: true });
}
