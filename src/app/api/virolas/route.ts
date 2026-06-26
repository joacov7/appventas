import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const virolas = await prisma.virola.findMany({
    where: { activa: true },
    orderBy: [{ posicion: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(virolas);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = await req.json();
  const { nombre, slug, descripcion, material, diametroMm, precioBase, imageUrl, posicion } = body;

  if (!nombre?.trim() || !slug?.trim() || !precioBase)
    return NextResponse.json({ error: "nombre, slug y precioBase son requeridos" }, { status: 400 });

  const virola = await prisma.virola.create({
    data: {
      nombre: nombre.trim(),
      slug: slug.trim().toLowerCase(),
      descripcion: descripcion?.trim() || null,
      material: material?.trim() || "madera",
      diametroMm: Number(diametroMm) || 35,
      precioBase: Number(precioBase),
      imageUrl: imageUrl?.trim() || null,
      posicion: Number(posicion) || 0,
    },
  });
  return NextResponse.json(virola, { status: 201 });
}
