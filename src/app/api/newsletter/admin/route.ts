export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const [suscriptores, resumen] = await Promise.all([
    (prisma as any).$queryRawUnsafe(
      `SELECT id, email, nombre, estado, cupon_code, creado_en
       FROM suscriptores_newsletter
       ORDER BY creado_en DESC LIMIT 200`
    ).catch(() => []),
    (prisma as any).$queryRawUnsafe(
      `SELECT estado, COUNT(*)::int AS cantidad FROM suscriptores_newsletter GROUP BY estado`
    ).catch(() => []),
  ]);

  return NextResponse.json({ suscriptores, resumen });
}

// PATCH /:id — toggle estado (activo/baja)
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id, estado } = await req.json();
  await (prisma as any).$executeRawUnsafe(
    `UPDATE suscriptores_newsletter SET estado = $2, baja_en = CASE WHEN $2 = 'baja' THEN now() ELSE NULL END WHERE id = $1`,
    id, estado
  );
  return NextResponse.json({ ok: true });
}
