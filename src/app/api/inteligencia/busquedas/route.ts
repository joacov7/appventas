import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT id, termino, plataforma, activa, umbral_alerta, creado_en
     FROM busquedas_competidores ORDER BY id`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { termino, plataforma = "todas", umbral_alerta = 10 } = await req.json();
  if (!termino?.trim()) return NextResponse.json({ error: "Término requerido" }, { status: 400 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `INSERT INTO busquedas_competidores (termino, plataforma, umbral_alerta)
     VALUES ($1, $2, $3) RETURNING *`,
    termino.trim(), plataforma, Number(umbral_alerta)
  );
  return NextResponse.json(rows[0], { status: 201 });
}
