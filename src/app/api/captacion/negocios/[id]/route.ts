import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const { activo } = await req.json();
  const rows = await (prisma as any).$queryRawUnsafe(
    `UPDATE negocios_competidores SET activo = $1 WHERE id = $2 RETURNING *`,
    Boolean(activo), Number(id)
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM negocios_competidores WHERE id = $1`, Number(id)
  );
  return NextResponse.json({ ok: true });
}
