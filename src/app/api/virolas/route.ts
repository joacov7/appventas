export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin, adminAuthError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS virolas (
      id           SERIAL PRIMARY KEY,
      nombre       TEXT NOT NULL,
      slug         TEXT NOT NULL UNIQUE,
      descripcion  TEXT,
      material     TEXT NOT NULL DEFAULT 'madera',
      diametro_mm  INT  NOT NULL DEFAULT 35,
      precio_base  NUMERIC(10,2) NOT NULL DEFAULT 0,
      image_url    TEXT,
      diseno_base  TEXT,
      activa       BOOLEAN NOT NULL DEFAULT true,
      posicion     INT NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Add columns that may be missing if table was created with an older schema
  for (const col of [
    `ALTER TABLE virolas ADD COLUMN IF NOT EXISTS diseno_base TEXT`,
    `ALTER TABLE virolas ADD COLUMN IF NOT EXISTS image_url TEXT`,
    `ALTER TABLE virolas ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE virolas ADD COLUMN IF NOT EXISTS posicion INT NOT NULL DEFAULT 0`,
    `ALTER TABLE virolas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  ]) {
    await (prisma as any).$executeRawUnsafe(col);
  }
}

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
  await ensureTable();
  const admin = await isAdmin();
  const rows: any[] = admin
    ? await (prisma as any).$queryRawUnsafe(`SELECT * FROM virolas ORDER BY posicion ASC, id ASC`)
    : await (prisma as any).$queryRawUnsafe(`SELECT * FROM virolas WHERE activa = true ORDER BY posicion ASC, id ASC`);
  return NextResponse.json(rows.map(row));
}

export async function POST(req: NextRequest) {
  const authErr = await adminAuthError();
  if (authErr) return NextResponse.json({ error: authErr }, { status: 401 });
  await ensureTable();
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
