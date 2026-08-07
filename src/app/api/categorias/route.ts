import { isAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json(categories.map(c => ({
      id: c.id, name: c.name, slug: c.slug, description: c.description,
      productos: (c as any)._count?.products ?? 0,
    })));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  }
  try {
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    // Slug único: base + sufijo aleatorio corto.
    const slug = `${slugify(name).slice(0, 50)}-${Math.random().toString(36).slice(2, 6)}`;
    const category = await prisma.category.create({ data: { name: name.trim(), slug } });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear categoría" }, { status: 500 });
  }
}
