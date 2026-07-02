export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTables() {
  // Ensure unique constraint on (tienda_id, url) for bulk upsert
  await (prisma as any).$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'productos_competidores_tienda_url_unique'
      ) THEN
        ALTER TABLE productos_competidores
          ADD CONSTRAINT productos_competidores_tienda_url_unique UNIQUE (tienda_id, url);
      END IF;
    END $$
  `).catch(() => {});
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTables();
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT t.id, t.nombre, t.url, t.plataforma, t.activa, t.ultimo_scrape,
            COUNT(p.id)::int AS total_productos,
            COUNT(CASE WHEN p.precio < p.precio_anterior THEN 1 END)::int AS bajadas
     FROM tiendas_competidoras t
     LEFT JOIN productos_competidores p ON p.tienda_id = t.id AND p.disponible = true
     GROUP BY t.id ORDER BY t.creado_en DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  let { nombre, url } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

  url = url.trim().replace(/\/$/, "");
  if (!url.startsWith("http")) url = "https://" + url;
  // Guardar solo la raíz del dominio: la API de estas plataformas vive ahí,
  // pegar la URL con path (ej. /productos) rompía el scrape
  try { url = new URL(url).origin; } catch {}

  // Detect platform from URL hints (auto-detect will override on scrape)
  let plataforma = "desconocido";
  if (url.includes("mitiendanube.com") || url.includes("tiendanube.com")) plataforma = "tiendanube";
  else if (url.includes("empretienda.com.ar")) plataforma = "empretienda";
  else if (url.includes("mercadolibre.com")) plataforma = "mercadolibre";

  if (!nombre?.trim()) {
    try { nombre = new URL(url).hostname.replace(/^www\./, "").split(".")[0].replace(/-/g, " "); } catch { nombre = url; }
  }

  const rows = await (prisma as any).$queryRawUnsafe(
    `INSERT INTO tiendas_competidoras (nombre, url, plataforma)
     VALUES ($1, $2, $3)
     ON CONFLICT (url) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING *`,
    nombre.trim(), url, plataforma
  );
  return NextResponse.json(rows[0], { status: 201 });
}
