export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

// Renombrar / editar una categoría.
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  const data: any = { name: name.trim() };
  data.slug = `${slugify(name).slice(0, 50)}-${id.slice(-4)}`;
  const cat = await prisma.category.update({ where: { id }, data });
  return NextResponse.json(cat);
}

// Borrar: desactiva la categoría y deja sus productos "sin categoría".
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await prisma.category.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
