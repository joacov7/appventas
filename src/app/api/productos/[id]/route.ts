import { isAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id }, { slug: id }], active: true },
      include: {
        category: true,
        variants: { where: { active: true }, orderBy: { price: "asc" } },
      },
    });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 });
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  categoryId: z.string().optional().nullable(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const product = await prisma.product.update({
      where: { id },
      data: body,
      include: { variants: true, category: true },
    });
    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.product.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
