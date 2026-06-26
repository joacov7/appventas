import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM tiendas_competidoras WHERE id = $1`, Number(id)
  );
  return NextResponse.json({ ok: true });
}
