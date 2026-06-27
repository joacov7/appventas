export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin, adminAuthError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function row(r: any) {
  return {
    id: Number(r.id),
    nombre: r.nombre,
    slug: r.slug,
    descripcion: r.descripcion ?? null,
    material: r.material,
    diametroMm: Number(r.diametro_mm),
    precioBase: r.precio_base,
    imageUrl: r.image_url ?? null,
    disenoBase: r.diseno_base ?? null,
    activa: r.activa,
    posicion: Number(r.posicion),
    createdAt: r.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await isAdmin();
    const rows: any[] = admin
      ? await (prisma as any).$queryRawUnsafe(`SELECT * FROM virolas ORDER BY posicion ASC, id ASC`)
      : await (prisma as any).$queryRawUnsafe(`SELECT * FROM virolas WHERE activa = true ORDER BY posicion ASC, id ASC`);
    return NextResponse.json(rows.map(row));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error al cargar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = await adminAuthError();
  if (authErr) return NextResponse.json({ error: authErr }, { status: 401 });

  const body = await req.json();
  const { nombre, slug, descripcion, material, diametroMm, precioBase, imageUrl, disenoBase, posicion } = body;

  if (!nombre?.trim() || !slug?.trim() || !precioBase)
    return NextResponse.json({ error: "nombre, slug y precioBase son requeridos" }, { status: 400 });

  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO virolas (nombre, slug, descripcion, material, diametro_mm, precio_base, image_url, diseno_base, posicion)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
      nombre.trim(),
      slug.trim().toLowerCase(),
      descripcion?.trim() || null,
      material || "madera",
      Number(diametroMm) || 35,
      Number(precioBase),
      imageUrl || null,
      disenoBase || null,
      Number(posicion) || 0,
    );
    return NextResponse.json(row(rows[0]), { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error al guardar" }, { status: 500 });
  }
}
