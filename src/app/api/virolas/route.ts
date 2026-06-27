export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureDisenoCols() {
  // Agrega la columna disenoBase si no existe (la tabla ya la creó Prisma)
  await (prisma as any).$executeRawUnsafe(`
    ALTER TABLE virolas ADD COLUMN IF NOT EXISTS "disenoBase" TEXT
  `);
}

function row(r: any) {
  return {
    id: Number(r.id),
    nombre: r.nombre,
    slug: r.slug,
    descripcion: r.descripcion,
    material: r.material,
    diametroMm: Number(r.diametroMm),
    precioBase: r.precioBase,
    imageUrl: r.imageUrl,
    disenoBase: r.disenoBase ?? null,
    activa: r.activa,
    posicion: Number(r.posicion),
    createdAt: r.createdAt,
  };
}

export async function GET(req: NextRequest) {
  await ensureDisenoCols();
  const admin = await isAdmin();
  const rows: any[] = admin
    ? await (prisma as any).$queryRawUnsafe(`SELECT * FROM virolas ORDER BY posicion ASC, id ASC`)
    : await (prisma as any).$queryRawUnsafe(`SELECT * FROM virolas WHERE activa = true ORDER BY posicion ASC, id ASC`);
  return NextResponse.json(rows.map(row));
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureDisenoCols();
  const body = await req.json();
  const { nombre, slug, descripcion, material, diametroMm, precioBase, imageUrl, disenoBase, posicion } = body;

  if (!nombre?.trim() || !slug?.trim() || !precioBase)
    return NextResponse.json({ error: "nombre, slug y precioBase son requeridos" }, { status: 400 });

  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    INSERT INTO virolas (nombre, slug, descripcion, material, "diametroMm", "precioBase", "imageUrl", "disenoBase", posicion, activa, "createdAt", "updatedAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW(),NOW())
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
}
