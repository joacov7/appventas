import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT t.id, t.nombre, t.url, t.plataforma, t.activa, t.ultimo_scrape,
            COUNT(p.id)::int AS total_productos
     FROM tiendas_competidoras t
     LEFT JOIN productos_competidores p ON p.tienda_id = t.id
     GROUP BY t.id ORDER BY t.creado_en DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  let { nombre, url } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

  // Normalizar URL (sacar trailing slash, forzar https)
  url = url.trim().replace(/\/$/, "");
  if (!url.startsWith("http")) url = "https://" + url;

  // Detectar plataforma
  let plataforma = "otro";
  if (url.includes("mitiendanube.com") || url.includes("mitienda.com")) plataforma = "tiendanube";
  else if (url.includes("empretienda.com.ar")) plataforma = "empretienda";

  if (!nombre?.trim()) {
    try { nombre = new URL(url).hostname.split(".")[0].replace(/-/g, " "); } catch { nombre = url; }
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
