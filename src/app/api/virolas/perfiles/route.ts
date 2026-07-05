import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

async function ensureTable() {
  await ensureSchema("ventas");
}

export async function GET() {
  await ensureTable();
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM perfiles_laser WHERE activo = true ORDER BY material, nombre`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const { nombre, material, potencia, velocidad, pasadas, notas } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `INSERT INTO perfiles_laser (nombre, material, potencia, velocidad, pasadas, notas)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    nombre.trim(),
    material?.trim() || "todos",
    Number(potencia) || 80,
    Number(velocidad) || 100,
    Number(pasadas) || 1,
    notas?.trim() || null
  );
  return NextResponse.json(rows[0], { status: 201 });
}
