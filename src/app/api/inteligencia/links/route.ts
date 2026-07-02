export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS producto_competidor_links (
      id            SERIAL PRIMARY KEY,
      product_id    TEXT NOT NULL,
      competidor_id INT NOT NULL REFERENCES productos_competidores(id) ON DELETE CASCADE,
      estado        TEXT NOT NULL DEFAULT 'confirmado',
      creado_en     TIMESTAMPTZ DEFAULT now(),
      UNIQUE (product_id, competidor_id)
    )
  `);
  // Similitud de texto para las sugerencias (si el rol de DB lo permite)
  await (prisma as any).$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`).catch(() => {});
}

// GET ?productId=xxx → { links: [...], sugerencias: [...] }
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();

  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId requerido" }, { status: 400 });

  const producto = await prisma.product.findUnique({ where: { id: productId } });
  if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  const links: any[] = await (prisma as any).$queryRawUnsafe(`
    SELECT l.id, l.competidor_id, l.estado,
           p.nombre, p.precio::float, p.imagen, p.url, p.disponible,
           t.nombre AS tienda_nombre
    FROM producto_competidor_links l
    JOIN productos_competidores p ON p.id = l.competidor_id
    JOIN tiendas_competidoras t ON t.id = p.tienda_id
    WHERE l.product_id = $1
    ORDER BY l.estado, p.precio
  `, productId);

  const excluidos = links.map(l => l.competidor_id);
  const exclusion = excluidos.length ? `AND p.id != ALL($2::int[])` : "";
  const args: any[] = excluidos.length ? [producto.name, excluidos] : [producto.name];

  // Candidatos por similitud de nombre (pg_trgm); fallback a palabras con ILIKE
  let sugerencias: any[] = [];
  try {
    sugerencias = await (prisma as any).$queryRawUnsafe(`
      SELECT p.id AS competidor_id, p.nombre, p.precio::float, p.imagen, p.url,
             t.nombre AS tienda_nombre,
             similarity(LOWER(p.nombre), LOWER($1)) AS score
      FROM productos_competidores p
      JOIN tiendas_competidoras t ON t.id = p.tienda_id
      WHERE p.disponible = TRUE
        AND similarity(LOWER(p.nombre), LOWER($1)) > 0.2
        ${exclusion}
      ORDER BY score DESC
      LIMIT 15
    `, ...args);
  } catch {
    // Sin pg_trgm: buscar por palabras significativas del nombre
    const palabras = producto.name.toLowerCase().split(/\s+/).filter(w => w.length >= 4).slice(0, 3);
    if (palabras.length) {
      const cond = palabras.map((_, i) => `LOWER(p.nombre) LIKE $${i + 1}`).join(" OR ");
      const likeArgs: any[] = palabras.map(w => `%${w}%`);
      let exclusionFb = "";
      if (excluidos.length) {
        exclusionFb = `AND p.id != ALL($${palabras.length + 1}::int[])`;
        likeArgs.push(excluidos);
      }
      sugerencias = await (prisma as any).$queryRawUnsafe(`
        SELECT p.id AS competidor_id, p.nombre, p.precio::float, p.imagen, p.url,
               t.nombre AS tienda_nombre, 0 AS score
        FROM productos_competidores p
        JOIN tiendas_competidoras t ON t.id = p.tienda_id
        WHERE p.disponible = TRUE AND (${cond}) ${exclusionFb}
        ORDER BY p.ultima_vez DESC
        LIMIT 15
      `, ...likeArgs);
    }
  }

  return NextResponse.json({ links, sugerencias });
}

// POST { productId, competidorId, estado: "confirmado" | "descartado" }
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();

  const { productId, competidorId, estado } = await req.json();
  if (!productId || !competidorId || !["confirmado", "descartado"].includes(estado)) {
    return NextResponse.json({ error: "productId, competidorId y estado (confirmado|descartado) requeridos" }, { status: 400 });
  }

  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    INSERT INTO producto_competidor_links (product_id, competidor_id, estado)
    VALUES ($1, $2, $3)
    ON CONFLICT (product_id, competidor_id) DO UPDATE SET estado = EXCLUDED.estado
    RETURNING *
  `, String(productId), Number(competidorId), estado);

  return NextResponse.json(rows[0], { status: 201 });
}

// DELETE ?id=N → quita el vínculo
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await (prisma as any).$executeRawUnsafe(`DELETE FROM producto_competidor_links WHERE id = $1`, Number(id));
  return NextResponse.json({ ok: true });
}
