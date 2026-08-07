export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const rows = await (prisma as any).$queryRawUnsafe(`
      SELECT c.*,
        COALESCE((SELECT SUM(m.invertido) FROM meta_metricas m WHERE m.campana_id = c.id), 0)::float AS total_invertido,
        COALESCE((SELECT SUM(m.leads) FROM meta_metricas m WHERE m.campana_id = c.id), 0)::int AS total_leads,
        COALESCE((SELECT SUM(m.ventas) FROM meta_metricas m WHERE m.campana_id = c.id), 0)::int AS total_ventas,
        COALESCE((SELECT SUM(m.clics) FROM meta_metricas m WHERE m.campana_id = c.id), 0)::int AS total_clics,
        COALESCE((SELECT SUM(m.impresiones) FROM meta_metricas m WHERE m.campana_id = c.id), 0)::int AS total_impresiones,
        COALESCE((SELECT SUM(m.ingresos) FROM meta_metricas m WHERE m.campana_id = c.id), 0)::float AS total_ingresos
      FROM meta_campanas c
      ORDER BY c.creado_en DESC
    `);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { nombre, estado, objetivo, fecha_inicio, fecha_fin, presupuesto_diario, presupuesto_total, notas } = await req.json();
    if (!nombre) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });
    const rows = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_campanas (nombre, estado, objetivo, fecha_inicio, fecha_fin, presupuesto_diario, presupuesto_total, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, nombre, estado ?? "borrador", objetivo ?? "ventas",
       fecha_inicio ?? null, fecha_fin ?? null,
       presupuesto_diario ? Number(presupuesto_diario) : null,
       presupuesto_total ? Number(presupuesto_total) : null,
       notas ?? null);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
