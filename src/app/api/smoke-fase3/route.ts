export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { createOrMerge, vincularAccion, transicionar } from "@/lib/agents";
import { registrarResultado, atribuirVenta, resumenResultados, resultadosDe } from "@/lib/agents/resultados";
import { aprobarAccion } from "@/lib/agents/acciones-exec";

// ⚠️ ENDPOINT TEMPORAL — verifica la Fase 3 (Recommendation → Action → Result)
// contra la base real. Se elimina después. Tenant aislado smoke3-<ts> (se limpia).
// La ejecución usa producto ficticio → no cambia precios reales.
const TOKEN = "1e4151522037ecb10b87678f300bdc8e";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const T = `smoke3-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);
  const e = (s: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(s, ...a);
  let limpio = false;
  const recoIds: number[] = [];

  try {
    await ensureSchema("agentes");

    // 1. Auto-registro de resultado 'ejecutada'/'error' al APROBAR una acción.
    const { recommendation: rc1 } = await createOrMerge({
      tenantId: T, agentId: "comercial", tipo: "precio", titulo: "Ajuste APR",
      entityType: "producto", entityId: "SMOKE3-APR", severidad: "importante",
      origenConfianza: "inferencia_alta", actionTool: "aplicar_precio",
      actionInput: { productId: "SMOKE3-APR", precio: 100 },
    });
    recoIds.push(rc1.id);
    const aq: any[] = await q(`INSERT INTO action_queue (agent_id, tool, input, estado) VALUES ($1,'aplicar_precio',$2::jsonb,'pendiente') RETURNING id`, `smoke:${T}`, JSON.stringify({ productId: "SMOKE3-APR", precio: 100 }));
    const aqId = Number(aq[0].id);
    await vincularAccion(rc1.id, aqId);
    await transicionar(rc1.id, "pending_approval").catch(() => {});
    await aprobarAccion(aqId, undefined);
    const resApr = await resultadosDe(rc1.id);
    push("1. Aprobar registra resultado (ejecutada/error) vinculado",
      resApr.length >= 1 && ["ejecutada", "error"].includes(resApr[0].tipo),
      `resultados=${resApr.length}, tipo=${resApr[0]?.tipo}`);

    // 2. Registrar un resultado manual ('no_respondio') + enlaza result_id.
    const { recommendation: rc2 } = await createOrMerge({
      tenantId: T, agentId: "seguimiento", tipo: "seguimiento", titulo: "Seguir Juan",
      entityType: "prospecto", entityId: "SMOKE3-P2", severidad: "oportunidad", origenConfianza: "deterministico",
    });
    recoIds.push(rc2.id);
    const ridManual = await registrarResultado({ tenantId: T, recommendationId: rc2.id, tipo: "no_respondio", fuente: "usuario" });
    const rc2row: any[] = await q(`SELECT result_id FROM recommendations WHERE id=$1`, rc2.id);
    push("2. Resultado manual registrado + result_id enlazado",
      ridManual != null && Number(rc2row[0].result_id) === ridManual, `result_id=${rc2row[0]?.result_id}`);

    // 3. Atribución de venta por vínculo EXPLÍCITO → resultado 'compro' con valor real.
    const { recommendation: rc3 } = await createOrMerge({
      tenantId: T, agentId: "postventa", tipo: "recompra", titulo: "Reactivar cliente",
      entityType: "cliente", entityId: "SMOKE3-C3", severidad: "oportunidad", origenConfianza: "deterministico",
    });
    recoIds.push(rc3.id);
    const ridVenta = await atribuirVenta(rc3.id, { ventaId: "VENTA-SMOKE3", valor: 15000 }, "usuario", T);
    const rVenta = await resultadosDe(rc3.id);
    const compro = rVenta.find((x: any) => x.tipo === "compro");
    push("3. Atribución de venta (vínculo explícito, valor real)",
      ridVenta != null && !!compro && Number(compro.valor_real) === 15000 && compro.venta_id === "VENTA-SMOKE3",
      `valor_real=${compro?.valor_real}, venta_id=${compro?.venta_id}`);

    // 4. Métricas: valor REAL separado del ESTIMADO.
    // Sembramos una reco 'executed' con valor_esperado (estimado) en T.
    const { recommendation: rc4 } = await createOrMerge({
      tenantId: T, agentId: "comercial", tipo: "precio", titulo: "Ejecutada estimada",
      entityType: "producto", entityId: "SMOKE3-EST", severidad: "importante",
      origenConfianza: "calculo", impactoEstimado: 5000, probabilidad: 0.5, margen: 0.4, // VE=1000
    });
    recoIds.push(rc4.id);
    await e(`UPDATE recommendations SET estado='executed', updated_at=now() WHERE id=$1`, rc4.id);
    const resumen = await resumenResultados(T);
    // Real: 15000 (la venta). Estimado: 1000 (VE de la ejecutada). Separados.
    push("4. Métricas: real vs estimado separados",
      resumen.reales.valorRealTotal === 15000 && resumen.reales.positivos === 1 && resumen.valorEstimadoEjecutadas === 1000,
      `real=${resumen.reales.valorRealTotal}, estimado=${resumen.valorEstimadoEjecutadas}, positivos=${resumen.reales.positivos}`);

    // 5. No se inventa valor: un 'compro' sin monto no suma al total real.
    const { recommendation: rc5 } = await createOrMerge({
      tenantId: T, agentId: "postventa", tipo: "recompra", titulo: "Compra sin monto",
      entityType: "cliente", entityId: "SMOKE3-C5", severidad: "oportunidad", origenConfianza: "deterministico",
    });
    recoIds.push(rc5.id);
    await registrarResultado({ tenantId: T, recommendationId: rc5.id, tipo: "compro", valorReal: null, fuente: "usuario" });
    const resumen2 = await resumenResultados(T);
    push("5. No inventa: compra sin monto no suma al valor real",
      resumen2.reales.valorRealTotal === 15000 && resumen2.reales.positivos === 2,
      `real=${resumen2.reales.valorRealTotal}, positivos=${resumen2.reales.positivos}, conValorReal=${resumen2.reales.conValorReal}`);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    try {
      const ids = recoIds.length ? recoIds.join(",") : "-1";
      await e(`DELETE FROM action_results WHERE tenant_id=$1 OR recommendation_id IN (${ids})`, T);
      await e(`DELETE FROM recommendation_sources WHERE recommendation_id IN (${ids})`);
      await e(`DELETE FROM recommendations WHERE tenant_id=$1`, T);
      await e(`DELETE FROM action_queue WHERE agent_id=$1`, `smoke:${T}`);
      const rest: any[] = await q(`SELECT COUNT(*)::int n FROM action_results WHERE tenant_id=$1 OR recommendation_id IN (${ids})`, T);
      limpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter(c => c.ok).length;
  return NextResponse.json({
    tenant: T, limpio, resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL", checks,
  });
}
