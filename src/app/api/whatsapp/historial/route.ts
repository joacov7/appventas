export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  try {
    const [mensajes, stats] = await Promise.all([
      (prisma as any).$queryRawUnsafe(`
        SELECT id, wa_id, direccion, texto, creado_en
        FROM whatsapp_mensajes
        ORDER BY creado_en DESC LIMIT $1
      `, limit),
      (prisma as any).$queryRawUnsafe(`
        SELECT
          COUNT(DISTINCT wa_id)::int AS conversaciones,
          COUNT(*) FILTER (WHERE direccion = 'entrante')::int AS entrantes,
          COUNT(*) FILTER (WHERE direccion = 'saliente')::int AS salientes
        FROM whatsapp_mensajes
      `),
    ]);
    return NextResponse.json({ mensajes, stats: stats[0] });
  } catch {
    return NextResponse.json({ mensajes: [], stats: { conversaciones: 0, entrantes: 0, salientes: 0 } });
  }
}
