import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS negocios_competidores (
      id        SERIAL PRIMARY KEY,
      nombre    TEXT NOT NULL,
      url       TEXT UNIQUE NOT NULL,
      activo    BOOLEAN DEFAULT TRUE,
      creado_en TIMESTAMPTZ DEFAULT now()
    )
  `);
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM negocios_competidores ORDER BY creado_en DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const { nombre, url } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

  // Normalizar: aceptar URL corta de Google Maps o URL completa
  const urlNorm = url.trim();
  const nombreFinal = nombre?.trim() || extraerNombre(urlNorm);

  const rows = await (prisma as any).$queryRawUnsafe(
    `INSERT INTO negocios_competidores (nombre, url)
     VALUES ($1, $2)
     ON CONFLICT (url) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING *`,
    nombreFinal, urlNorm
  );
  return NextResponse.json(rows[0], { status: 201 });
}

function extraerNombre(url: string): string {
  try {
    const m = url.match(/\/maps\/place\/([^/@]+)/);
    if (m) return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {}
  return url.slice(0, 60);
}
