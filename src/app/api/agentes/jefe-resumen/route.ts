export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { generarResumenJefe, ultimoResumenJefe } from "@/lib/agents/jefe-gabinete";

// GET → último resumen del Jefe persistido (para el Centro de Decisiones).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const resumen = await ultimoResumenJefe();
  return NextResponse.json({ resumen });
}

// POST → regenera el resumen del Jefe ahora (dedup/agrupa/prioriza/resume).
// Body opcional { usarIA: boolean } para forzar el modo plantilla (sin IA).
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  let usarIA: boolean | undefined;
  try { const b = await req.json(); usarIA = b?.usarIA; } catch { /* sin body */ }
  const r = await generarResumenJefe({ usarIA });
  return NextResponse.json(r);
}
