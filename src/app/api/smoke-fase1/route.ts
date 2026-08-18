export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { runAgent, getAgent, createOrMerge, vincularAccion, ESTADOS_VIVOS } from "@/lib/agents";

// ⚠️ ENDPOINT TEMPORAL — SOLO PARA CORRER EL SMOKE DE LA FASE 1 UNA VEZ.
// Se elimina después de usarlo. Protegido por token. Usa un tenant aislado
// (smoke-<ts>) y limpia TODO al final. El único agente real que ejecuta es
// "finanzas" (solo lectura). No toca datos de negocio de forma irreversible.
const TOKEN = "7e03b81e22bcda6d667b182d6993c1f9";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const TENANT = `smoke-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (paso: string, ok: boolean, detalle?: string) => checks.push({ paso, ok, detalle });
  const vivosSql = ESTADOS_VIVOS.map((e) => `'${e}'`).join(",");
  let runIdInicial = 0;
  let tenantLimpio = false;

  const q = (sql: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(sql, ...a);
  const e = (sql: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(sql, ...a);

  try {
    await ensureSchema("agentes");

    // 1-2. Agente real (finanzas, solo lectura) + agent_runs running→completed/failed.
    const max: any[] = await q(`SELECT COALESCE(MAX(id),0)::bigint AS m FROM agent_runs`);
    runIdInicial = Number(max[0].m);
    const def = getAgent("finanzas");
    const res = await runAgent(def!, "manual");
    push("1. Agente real ejecutado (finanzas)", true, `ok=${res.ok} · ${res.ms}ms`);
    const runRows: any[] = await q(
      `SELECT estado, finished_at FROM agent_runs WHERE agent_id='finanzas' AND id > $1 ORDER BY id DESC LIMIT 1`,
      runIdInicial);
    const run = runRows[0];
    const estadoOk = !!run && (run.estado === "completed" || run.estado === "failed") && !!run.finished_at;
    push("2. agent_runs running→completed/failed + finished_at", estadoOk, run ? `estado=${run.estado}` : "sin fila");

    // 3-4. Persistir recomendación con dedup_key.
    const key = `precio_alto:producto:SMOKE-${Date.now()}`;
    const r1 = await createOrMerge({
      tenantId: TENANT, agentId: "comercial", tipo: "precio_alto",
      titulo: "Producto caro vs mercado", entityType: "producto", entityId: "SMOKE",
      dedupKey: key, severidad: "importante", origenConfianza: "calculo",
      impactoEstimado: 8000, probabilidad: 0.6, margen: 0.35,
      actionTool: "aplicar_precio", actionInput: { productId: "SMOKE", precio: 29990 },
    });
    push("3. Recomendación persistida", !r1.merged && !!r1.recommendation.id, `id=${r1.recommendation.id}`);
    push("4. dedup_key + estado + valor_esperado",
      r1.recommendation.dedup_key === key && r1.recommendation.estado === "proposed" && r1.recommendation.valor_esperado === 1680,
      `estado=${r1.recommendation.estado}, VE=${r1.recommendation.valor_esperado}`);

    // 5-8. Re-ejecutar el escenario: mergea, no duplica, suma fuente, mantiene datos.
    const r2 = await createOrMerge({
      tenantId: TENANT, agentId: "inteligencia", tipo: "precio_alto",
      titulo: "Producto caro vs mercado", entityType: "producto", entityId: "SMOKE",
      dedupKey: key, severidad: "critica", origenConfianza: "calculo",
    });
    const vivas: any[] = await q(
      `SELECT COUNT(*)::int AS n FROM recommendations WHERE tenant_id=$1 AND dedup_key=$2 AND estado IN (${vivosSql})`,
      TENANT, key);
    const fuentes: any[] = await q(
      `SELECT COUNT(*)::int AS n FROM recommendation_sources WHERE recommendation_id=$1`, r1.recommendation.id);
    push("5. Re-ejecución mergea (no crea otra)", r2.merged && r2.recommendation.id === r1.recommendation.id);
    push("6. Una sola recomendación activa", vivas[0].n === 1, `vivas=${vivas[0].n}`);
    push("7. recommendation_sources agregado", fuentes[0].n === 2, `fuentes=${fuentes[0].n}`);
    push("8. Estado/datos mantenidos, severidad sube",
      r2.recommendation.estado === "proposed" && r2.recommendation.severidad === "critica" && r2.recommendation.valor_esperado === 1680,
      `estado=${r2.recommendation.estado}, sev=${r2.recommendation.severidad}, VE=${r2.recommendation.valor_esperado}`);

    // 9. action_queue operativo + vínculo 1:1.
    const aqIns: any[] = await q(
      `INSERT INTO action_queue (agent_id, tool, input, estado) VALUES ($1,$2,$3::jsonb,'pendiente') RETURNING id`,
      `smoke:${TENANT}`, "aplicar_precio", JSON.stringify({ productId: "SMOKE", precio: 29990 }));
    const aqId = Number(aqIns[0].id);
    const primer = await vincularAccion(r1.recommendation.id, aqId);
    const segundo = await vincularAccion(r1.recommendation.id, aqId + 1);
    push("9. action_queue operativo + vínculo 1:1", aqId > 0 && primer === true && segundo === false, `aq=${aqId}`);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    // Limpieza total del tenant aislado + filas del agente real.
    try {
      await e(`DELETE FROM recommendation_sources WHERE recommendation_id IN (SELECT id FROM recommendations WHERE tenant_id=$1)`, TENANT);
      await e(`DELETE FROM recommendations WHERE tenant_id=$1`, TENANT);
      await e(`DELETE FROM action_queue WHERE agent_id=$1`, `smoke:${TENANT}`);
      if (runIdInicial) {
        await e(`DELETE FROM recommendation_sources WHERE recommendation_id IN (SELECT id FROM recommendations WHERE agent_id='finanzas' AND agent_run_id > $1)`, runIdInicial);
        await e(`DELETE FROM recommendations WHERE agent_id='finanzas' AND agent_run_id > $1`, runIdInicial);
        await e(`DELETE FROM agent_runs WHERE agent_id='finanzas' AND id > $1`, runIdInicial);
      }
      const rest: any[] = await q(`SELECT COUNT(*)::int AS n FROM recommendations WHERE tenant_id=$1`, TENANT);
      tenantLimpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter((c) => c.ok).length;
  return NextResponse.json({
    tenant: TENANT,
    tenant_limpio: tenantLimpio,
    resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL",
    checks,
  });
}
