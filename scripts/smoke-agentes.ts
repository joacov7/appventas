/**
 * Smoke test del núcleo de recomendaciones contra la base REAL.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." npm run smoke
 *
 * Es seguro: usa un tenant aislado y claramente identificable ("smoke-<ts>")
 * para todo lo que crea, y limpia TODO al final. No modifica datos de negocio
 * de forma irreversible. El único agente real que ejecuta es "finanzas", que es
 * de solo lectura (no envía WhatsApp, no cambia precios, no crea campañas).
 * Sus filas de auditoría (agent_runs) y las recomendaciones que genere se
 * borran al terminar, salvo que pases SMOKE_KEEP=1.
 *
 * Se corre a través de vitest (resuelve el alias @). Se saltea si no hay
 * DATABASE_URL, así el sandbox/CI no falla.
 */
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { runAgent, getAgent, createOrMerge, vincularAccion, ESTADOS_VIVOS } from "@/lib/agents";

const HAY_DB = !!process.env.DATABASE_URL;
const TENANT = `smoke-${Date.now()}`;
const check: { paso: string; ok: boolean; detalle: string }[] = [];
function record(paso: string, ok: boolean, detalle = "") { check.push({ paso, ok, detalle }); return ok; }

const vivosSql = ESTADOS_VIVOS.map(e => `'${e}'`).join(",");
async function contarVivas(key: string) {
  const r: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM recommendations WHERE tenant_id=$1 AND dedup_key=$2 AND estado IN (${vivosSql})`,
    TENANT, key);
  return r[0]?.n ?? 0;
}
async function contarFuentes(recoId: number) {
  const r: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM recommendation_sources WHERE recommendation_id=$1`, recoId);
  return r[0]?.n ?? 0;
}

describe.skipIf(!HAY_DB)("SMOKE — núcleo de recomendaciones (base real)", () => {
  let runIdInicial = 0;

  afterAll(async () => {
    // Limpieza del tenant aislado.
    await (prisma as any).$executeRawUnsafe(
      `DELETE FROM recommendation_sources WHERE recommendation_id IN (SELECT id FROM recommendations WHERE tenant_id=$1)`, TENANT).catch(() => {});
    await (prisma as any).$executeRawUnsafe(`DELETE FROM recommendations WHERE tenant_id=$1`, TENANT).catch(() => {});
    await (prisma as any).$executeRawUnsafe(`DELETE FROM action_queue WHERE agent_id=$1`, `smoke:${TENANT}`).catch(() => {});
    // Limpieza de lo generado por el agente real (salvo SMOKE_KEEP=1).
    if (!process.env.SMOKE_KEEP && runIdInicial) {
      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM recommendation_sources WHERE recommendation_id IN
           (SELECT id FROM recommendations WHERE agent_id='finanzas' AND agent_run_id > $1)`, runIdInicial).catch(() => {});
      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM recommendations WHERE agent_id='finanzas' AND agent_run_id > $1`, runIdInicial).catch(() => {});
      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM agent_runs WHERE agent_id='finanzas' AND id > $1`, runIdInicial).catch(() => {});
    }
    // Resumen PASS/FAIL.
    const pass = check.filter(c => c.ok).length;
    console.log("\n──────── SMOKE AGENTES · RESUMEN ────────");
    for (const c of check) console.log(`  ${c.ok ? "✅ PASS" : "❌ FAIL"}  ${c.paso}${c.detalle ? ` — ${c.detalle}` : ""}`);
    console.log(`  ${pass}/${check.length} OK  ·  tenant ${TENANT}${process.env.SMOKE_KEEP ? " (SMOKE_KEEP: datos conservados)" : " (limpiado)"}`);
    console.log("─────────────────────────────────────────\n");
  });

  it("1-2. Ejecuta un agente REAL (finanzas) y agent_runs va running→completed/failed", async () => {
    await ensureSchema("agentes");
    const max: any[] = await (prisma as any).$queryRawUnsafe(`SELECT COALESCE(MAX(id),0)::bigint AS m FROM agent_runs`);
    runIdInicial = Number(max[0].m);

    const def = getAgent("finanzas");
    expect(def).toBeTruthy();
    const res = await runAgent(def!, "manual");
    record("1. Agente real ejecutado", true, `finanzas · ok=${res.ok} · ${res.ms}ms`);

    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT id, estado, ok, finished_at, ms FROM agent_runs WHERE agent_id='finanzas' AND id > $1 ORDER BY id DESC LIMIT 1`, runIdInicial);
    expect(rows.length).toBe(1);
    const run = rows[0];
    const estadoOk = run.estado === "completed" || run.estado === "failed";
    expect(estadoOk).toBe(true);
    expect(run.finished_at).toBeTruthy();
    record("2. agent_runs cerró con estado válido", estadoOk, `estado=${run.estado}, finished_at seteado`);
  });

  it("3-4. Persiste una recomendación con dedup_key", async () => {
    const key = `precio_alto:producto:SMOKE-${Date.now()}`;
    const { recommendation, merged } = await createOrMerge({
      tenantId: TENANT, agentId: "comercial", tipo: "precio_alto",
      titulo: "Producto caro vs mercado", entityType: "producto", entityId: "SMOKE",
      dedupKey: key, severidad: "importante", origenConfianza: "calculo",
      impactoEstimado: 8000, probabilidad: 0.6, margen: 0.35,
      actionTool: "aplicar_precio", actionInput: { productId: "SMOKE", precio: 29990 },
    });
    expect(merged).toBe(false);
    expect(recommendation.dedup_key).toBe(key);
    expect(recommendation.estado).toBe("proposed"); // tiene action_tool
    expect(recommendation.valor_esperado).toBe(1680); // 8000 × 0.6 × 0.35
    record("3. Recomendación persistida", true, `id=${recommendation.id}`);
    record("4. dedup_key presente", true, key);
    (globalThis as any).__smokeKey = key;
    (globalThis as any).__smokeReco = recommendation;
  });

  it("5-8. Re-ejecuta el mismo escenario: mergea, no duplica, suma fuente, mantiene estado/datos", async () => {
    const key = (globalThis as any).__smokeKey as string;
    const previa = (globalThis as any).__smokeReco;
    const { recommendation, merged } = await createOrMerge({
      tenantId: TENANT, agentId: "inteligencia", tipo: "precio_alto",
      titulo: "Producto caro vs mercado", entityType: "producto", entityId: "SMOKE",
      dedupKey: key, severidad: "critica", origenConfianza: "calculo",
    });
    expect(merged).toBe(true);                          // 6. no crea otra
    expect(recommendation.id).toBe(previa.id);          // misma fila
    expect(await contarVivas(key)).toBe(1);             // 6. una sola viva
    expect(await contarFuentes(recommendation.id)).toBe(2); // 7. dos fuentes
    expect(recommendation.estado).toBe("proposed");     // 8. estado se mantiene
    expect(recommendation.severidad).toBe("critica");   // 8. severidad subió al máximo
    expect(recommendation.valor_esperado).toBe(1680);   // 8. datos previos preservados
    record("5. Re-ejecución del escenario", true);
    record("6. No hay segunda recomendación activa", true, "1 viva");
    record("7. recommendation_sources agregado", true, "2 fuentes");
    record("8. Estado y datos mantenidos", true, "estado=proposed, severidad=critica, VE=1680");
  });

  it("9. action_queue sigue funcionando y el vínculo recomendación↔acción es 1:1", async () => {
    const reco = (globalThis as any).__smokeReco;
    const ins: any[] = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO action_queue (agent_id, tool, input, estado) VALUES ($1,$2,$3::jsonb,'pendiente') RETURNING id`,
      `smoke:${TENANT}`, "aplicar_precio", JSON.stringify({ productId: "SMOKE", precio: 29990 }));
    const aqId = Number(ins[0].id);
    expect(aqId).toBeGreaterThan(0);
    const sel: any[] = await (prisma as any).$queryRawUnsafe(`SELECT * FROM action_queue WHERE id=$1`, aqId);
    expect(sel.length).toBe(1);
    const primer = await vincularAccion(reco.id, aqId);
    const segundo = await vincularAccion(reco.id, aqId + 1);
    expect(primer).toBe(true);   // se vincula la primera vez
    expect(segundo).toBe(false); // no se pisa → nunca dos ejecuciones
    record("9. action_queue operativo + vínculo 1:1", true, `aq=${aqId}`);
  });
});
