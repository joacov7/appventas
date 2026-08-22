export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { createOrMerge, ESTADOS_VIVOS } from "@/lib/agents";
import { scoreCliente, ameritaReactivacion } from "@/lib/agents/crm.logic";
import { scoringClientes } from "@/lib/services/crm.service";

// ⚠️ ENDPOINT TEMPORAL — verifica la Fase 5B (CRM Customer Score) contra la base
// real. Se elimina después. Solo lectura + una recomendación en tenant aislado
// (se limpia). No toca datos de negocio.
const TOKEN = "36417a990d27b56a04672ee5d8d1f362";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const T = `smoke5b-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);
  const e = (s: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(s, ...a);
  const vivos = ESTADOS_VIVOS.map(x => `'${x}'`).join(",");
  let limpio = false, ejemplos: any = null;

  try {
    await ensureSchema("agentes");

    // 1. Customer Score sobre datos reales (una sola lectura).
    const clientes = await scoringClientes(100);
    const bienFormados = clientes.every(c =>
      typeof c.score === "number" && c.score >= 0 && c.score <= 100 &&
      ["bajo", "medio", "alto"].includes(c.riesgo_abandono));
    push("1. customer_score devuelve clientes con score válido", Array.isArray(clientes) && bienFormados, `clientes=${clientes.length}`);
    ejemplos = clientes.slice(0, 3).map(c => ({ nombre: c.nombre, score: c.score, riesgo: c.riesgo_abandono, total: c.total_gastado, dias: c.dias_desde_ultima, proxima: c.proxima_accion }));

    // 2. Score determinístico (función real): valioso + pasado de frecuencia → riesgo alto.
    const s = scoreCliente(
      { key: "x", nombre: "X", email: null, telefono: null, compras: 4, total_gastado: 800000, ticket_promedio: 200000, ultima_compra: new Date().toISOString(), dias_desde_ultima: 60, frecuencia_dias: 30 },
      { maxValor: 1000000 });
    push("2. Score: valioso + pasado de su frecuencia → riesgo alto", s.riesgo_abandono === "alto" && s.score > 0, `score=${s.score}, riesgo=${s.riesgo_abandono}`);

    // 3. ameritaReactivacion filtra el ruido (bajo valor no).
    const ctx = { maxValor: 1000000 };
    const valioso = { key: "v", nombre: "V", email: null, telefono: null, compras: 3, total_gastado: 500000, ticket_promedio: 166000, ultima_compra: "", dias_desde_ultima: 60, frecuencia_dias: 30 };
    const chico = { ...valioso, total_gastado: 40000 };
    push("3. Solo reactiva clientes valiosos en riesgo (no ruido)",
      ameritaReactivacion(valioso, scoreCliente(valioso, ctx), ctx) === true &&
      ameritaReactivacion(chico, scoreCliente(chico, ctx), ctx) === false);

    // 4. Recomendación de reactivación persistida (entidad cliente + impacto real).
    const { recommendation } = await createOrMerge({
      tenantId: T, agentId: "postventa", tipo: "crm:reactivar",
      titulo: "Reactivar cliente valioso: Cliente Z", descripcion: "Score 72/100 · riesgo alto.",
      severidad: "importante", entityType: "cliente", entityId: "SMOKE5B-C",
      impactoEstimado: 166000, confianza: 85, origenConfianza: "calculo",
    });
    const grp: any[] = await q(
      `SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1 AND entity_type='cliente' AND estado IN (${vivos})`, T);
    push("4. Recomendación CRM persistida (entidad cliente, impacto real)",
      recommendation.impacto_estimado === 166000 && recommendation.entity_type === "cliente" && grp[0].n >= 1, `id=${recommendation.id}`);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    try {
      await e(`DELETE FROM recommendation_sources WHERE recommendation_id IN (SELECT id FROM recommendations WHERE tenant_id=$1)`, T);
      await e(`DELETE FROM recommendations WHERE tenant_id=$1`, T);
      const rest: any[] = await q(`SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1`, T);
      limpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter(c => c.ok).length;
  return NextResponse.json({
    tenant: T, limpio, resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL", ejemplos_crm: ejemplos, checks,
  });
}
