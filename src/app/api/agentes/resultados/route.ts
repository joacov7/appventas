export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { registrarResultado, atribuirVenta, resumenResultados, resultadosDe, TIPOS_RESULTADO } from "@/lib/agents/resultados";
import type { TipoResultado } from "@/lib/agents/resultados";

// GET → métricas del mes (real vs estimado). ?recommendationId=N → resultados de una reco.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const rid = req.nextUrl.searchParams.get("recommendationId");
  if (rid) {
    return NextResponse.json({ resultados: await resultadosDe(Number(rid)) });
  }
  return NextResponse.json(await resumenResultados());
}

// POST → registra un resultado observado para una recomendación.
// { recommendationId, tipo, valorReal?, ventaId? }
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { recommendationId, tipo, valorReal, ventaId } = body;
  if (!recommendationId || !tipo || !TIPOS_RESULTADO.includes(tipo)) {
    return NextResponse.json({ error: `recommendationId y tipo (${TIPOS_RESULTADO.join("|")}) requeridos` }, { status: 400 });
  }

  // Atribución de venta por vínculo explícito.
  if (tipo === "compro" && ventaId != null && valorReal != null) {
    const id = await atribuirVenta(Number(recommendationId), { ventaId: String(ventaId), valor: Number(valorReal) });
    return NextResponse.json({ ok: id != null, resultId: id, atribuida: true });
  }

  const id = await registrarResultado({
    recommendationId: Number(recommendationId), tipo: tipo as TipoResultado,
    valorReal: valorReal != null ? Number(valorReal) : null, fuente: "usuario",
  });
  return NextResponse.json({ ok: id != null, resultId: id });
}
