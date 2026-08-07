export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { searchParams } = req.nextUrl;
    const campana_id = searchParams.get("campana_id");
    const periodo = searchParams.get("periodo") ?? "30"; // days

    // Global totals
    const totals = await (prisma as any).$queryRawUnsafe(`
      SELECT
        COALESCE(SUM(invertido),0)::float AS invertido,
        COALESCE(SUM(alcance),0)::int AS alcance,
        COALESCE(SUM(impresiones),0)::int AS impresiones,
        COALESCE(SUM(clics),0)::int AS clics,
        COALESCE(SUM(conversaciones),0)::int AS conversaciones,
        COALESCE(SUM(leads),0)::int AS leads,
        COALESCE(SUM(ventas),0)::int AS ventas,
        COALESCE(SUM(ingresos),0)::float AS ingresos
      FROM meta_metricas
      WHERE fecha >= NOW() - ($1 || ' days')::INTERVAL
      ${campana_id ? "AND campana_id = $2" : ""}
    `, periodo, ...(campana_id ? [Number(campana_id)] : []));

    // Daily breakdown
    const daily = await (prisma as any).$queryRawUnsafe(`
      SELECT fecha::text, SUM(invertido)::float AS invertido, SUM(leads)::int AS leads,
             SUM(clics)::int AS clics, SUM(ventas)::int AS ventas, SUM(ingresos)::float AS ingresos
      FROM meta_metricas
      WHERE fecha >= NOW() - ($1 || ' days')::INTERVAL
      ${campana_id ? "AND campana_id = $2" : ""}
      GROUP BY fecha ORDER BY fecha ASC
    `, periodo, ...(campana_id ? [Number(campana_id)] : []));

    return NextResponse.json({ totals: totals[0], daily });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { campana_id, fecha, invertido, alcance, impresiones, clics, conversaciones, leads, ventas, ingresos } = await req.json();
    if (!campana_id || !fecha) return NextResponse.json({ error: "campana_id y fecha requeridos" }, { status: 400 });
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO meta_metricas (campana_id, fecha, invertido, alcance, impresiones, clics, conversaciones, leads, ventas, ingresos)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (campana_id, fecha) DO UPDATE SET
        invertido = $3, alcance = $4, impresiones = $5, clics = $6,
        conversaciones = $7, leads = $8, ventas = $9, ingresos = $10
    `, Number(campana_id), fecha,
       Number(invertido ?? 0), Number(alcance ?? 0), Number(impresiones ?? 0),
       Number(clics ?? 0), Number(conversaciones ?? 0), Number(leads ?? 0),
       Number(ventas ?? 0), Number(ingresos ?? 0));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
