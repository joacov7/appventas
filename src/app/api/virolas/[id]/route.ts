import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const virola = await prisma.virola.findUnique({ where: { id: Number(id) } });
  if (!virola) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(virola);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const virola = await prisma.virola.update({
    where: { id: Number(id) },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.slug !== undefined && { slug: body.slug.trim().toLowerCase() }),
      ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
      ...(body.material !== undefined && { material: body.material }),
      ...(body.diametroMm !== undefined && { diametroMm: Number(body.diametroMm) }),
      ...(body.precioBase !== undefined && { precioBase: Number(body.precioBase) }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.activa !== undefined && { activa: Boolean(body.activa) }),
      ...(body.posicion !== undefined && { posicion: Number(body.posicion) }),
    },
  });
  return NextResponse.json(virola);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  await prisma.virola.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
