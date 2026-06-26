import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") ?? undefined;

  const leads = await (prisma as any).$queryRawUnsafe(
    `SELECT id, autor, calificacion, competidor, estado, mensaje_abordaje, texto_queja, url_perfil, creado_en
     FROM leads_captacion
     ${estado ? "WHERE estado = $1" : ""}
     ORDER BY creado_en DESC
     LIMIT 100`,
    ...(estado ? [estado] : [])
  );

  return NextResponse.json(leads);
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { id, estado } = await req.json();
  if (!id || !estado) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  await (prisma as any).$executeRawUnsafe(
    `UPDATE leads_captacion SET estado = $1 WHERE id = $2`,
    estado,
    id
  );

  return NextResponse.json({ ok: true });
}
