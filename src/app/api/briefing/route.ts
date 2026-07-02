export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureBriefingTable, generarYGuardarBriefing } from "@/lib/briefing";

// GET → último briefing (o los últimos 7 con ?historial=1)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureBriefingTable();

  const historial = req.nextUrl.searchParams.get("historial") === "1";
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM briefings ORDER BY fecha DESC LIMIT ${historial ? 7 : 1}`
  );
  if (historial) return NextResponse.json(rows);
  return NextResponse.json(rows[0] ?? null);
}

// POST → generar/regenerar el briefing de hoy a demanda
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 503 });
  }
  try {
    const briefing = await generarYGuardarBriefing();
    return NextResponse.json(briefing, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error generando briefing" }, { status: 500 });
  }
}
