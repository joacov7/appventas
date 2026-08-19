export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { createOrMerge, vincularAccion, transicionar, marcarResultadoAccion, editarAccionInput, ESTADOS_VIVOS } from "@/lib/agents";
import { aprobarAccion, rechazarAccion } from "@/lib/agents/acciones-exec";

// ⚠️ ENDPOINT TEMPORAL — verifica el Paso 2B (API de recomendaciones:
// transiciones + reuso del flujo de acciones) contra la base real. Se elimina
// después. Protegido por token. Tenant aislado smoke2b-<ts> que se limpia.
// La ejecución usa un producto FICTICIO (aplicar_precio falla sin variante) para
// validar el cableado SIN cambiar precios reales.
const TOKEN = "25f7f4b934775a78cade31a8ffa8e8f5";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const T = `smoke2b-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);
  const e = (s: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(s, ...a);
  const vivos = ESTADOS_VIVOS.map(x => `'${x}'`).join(",");
  let limpio = false;

  // Crea una recomendación accionable + su orden en action_queue, vinculadas 1:1.
  async function recoConAccion(entityId: string, sev: string, precio = 100) {
    const { recommendation } = await createOrMerge({
      tenantId: T, agentId: "comercial", tipo: "precio", titulo: `Ajuste ${entityId}`,
      entityType: "producto", entityId, severidad: sev as any, origenConfianza: "inferencia_alta",
      actionTool: "aplicar_precio", actionInput: { productId: entityId, precio },
    });
    const aq: any[] = await q(`INSERT INTO action_queue (agent_id, tool, input, estado) VALUES ($1,'aplicar_precio',$2::jsonb,'pendiente') RETURNING id`, `smoke:${T}`, JSON.stringify({ productId: entityId, precio }));
    const aqId = Number(aq[0].id);
    await vincularAccion(recommendation.id, aqId);
    await transicionar(recommendation.id, "pending_approval").catch(() => {});
    return { recoId: recommendation.id, aqId };
  }

  try {
    await ensureSchema("agentes");

    // 1. APROBAR (con acción vinculada) → ejecuta vía flujo compartido y refleja
    //    el resultado; 2º intento no re-ejecuta (no doble ejecución).
    const a = await recoConAccion("SMOKE2B-APR", "importante");
    const r1 = await aprobarAccion(a.aqId, undefined);
    await marcarResultadoAccion(a.recoId, r1.ok); // producto ficticio → r1.ok=false
    const r2 = await aprobarAccion(a.aqId, undefined); // ya resuelta
    const aqEstado: any[] = await q(`SELECT estado FROM action_queue WHERE id=$1`, a.aqId);
    const recoEstado: any[] = await q(`SELECT estado FROM recommendations WHERE id=$1`, a.recoId);
    push("1. Aprobar ejecuta (flujo compartido) y no re-ejecuta",
      (aqEstado[0].estado === "ejecutada" || aqEstado[0].estado === "error") && r2.estado === "no_encontrada",
      `aq=${aqEstado[0].estado}, reco=${recoEstado[0].estado}, 2do=${r2.estado}`);

    // 2. RECHAZAR → action_queue 'rechazada' + recomendación 'rejected'.
    const b = await recoConAccion("SMOKE2B-REJ", "oportunidad");
    await rechazarAccion(b.aqId);
    const tRej = await transicionar(b.recoId, "rejected");
    const bAq: any[] = await q(`SELECT estado FROM action_queue WHERE id=$1`, b.aqId);
    const bReco: any[] = await q(`SELECT estado FROM recommendations WHERE id=$1`, b.recoId);
    push("2. Rechazar: action_queue rechazada + reco rejected",
      tRej.ok && bAq[0].estado === "rechazada" && bReco[0].estado === "rejected",
      `aq=${bAq[0].estado}, reco=${bReco[0].estado}`);

    // 3. POSPONER → recomendación 'postponed'.
    const c = await recoConAccion("SMOKE2B-POS", "importante");
    const tPos = await transicionar(c.recoId, "postponed");
    const cReco: any[] = await q(`SELECT estado FROM recommendations WHERE id=$1`, c.recoId);
    push("3. Posponer: reco postponed", tPos.ok && cReco[0].estado === "postponed", `reco=${cReco[0].estado}`);

    // 4. EDITAR → action_input de la reco + input de la orden actualizados.
    const d = await recoConAccion("SMOKE2B-EDI", "importante", 100);
    await editarAccionInput(d.recoId, { productId: "SMOKE2B-EDI", precio: 222 });
    await e(`UPDATE action_queue SET input = $2::jsonb WHERE id=$1 AND estado='pendiente'`, d.aqId, JSON.stringify({ productId: "SMOKE2B-EDI", precio: 222 }));
    const dReco: any[] = await q(`SELECT action_input FROM recommendations WHERE id=$1`, d.recoId);
    const dAq: any[] = await q(`SELECT input FROM action_queue WHERE id=$1`, d.aqId);
    push("4. Editar: input de reco y de la orden actualizados",
      dReco[0].action_input?.precio === 222 && dAq[0].input?.precio === 222,
      `reco.precio=${dReco[0].action_input?.precio}, aq.precio=${dAq[0].input?.precio}`);

    // 5. GET agrupado por severidad (misma consulta que la API, tenant aislado).
    await createOrMerge({ tenantId: T, agentId: "compras", tipo: "stock_bajo", titulo: "Crit", entityType: "producto", entityId: "SMOKE2B-CRIT", severidad: "critica", origenConfianza: "deterministico" });
    const grp: any[] = await q(
      `SELECT severidad, COUNT(*)::int n FROM recommendations WHERE tenant_id=$1 AND estado IN (${vivos}) GROUP BY severidad`, T);
    const conteo: Record<string, number> = {};
    for (const r of grp) conteo[r.severidad] = r.n;
    // Vivas esperadas: APR quedó terminal (executed/failed), REJ rejected → no vivas.
    // Vivas: POS(postponed=vivo, importante), EDI(pending_approval, importante), CRIT(new, critica).
    push("5. Agrupación por severidad (vivas)",
      (conteo["critica"] ?? 0) >= 1 && (conteo["importante"] ?? 0) >= 2,
      `criticas=${conteo["critica"] ?? 0}, importantes=${conteo["importante"] ?? 0}, oportunidades=${conteo["oportunidad"] ?? 0}`);

    // 6. Transición inválida rechazada (estado terminal no admite salto).
    const inval = await transicionar(b.recoId, "approved"); // b está 'rejected' (terminal)
    push("6. Transición inválida rechazada (server-side)", !inval.ok, inval.error ?? "");
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    try {
      await e(`DELETE FROM recommendation_sources WHERE recommendation_id IN (SELECT id FROM recommendations WHERE tenant_id=$1)`, T);
      await e(`DELETE FROM recommendations WHERE tenant_id=$1`, T);
      await e(`DELETE FROM action_queue WHERE agent_id=$1`, `smoke:${T}`);
      const rest: any[] = await q(`SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1`, T);
      limpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter(c => c.ok).length;
  return NextResponse.json({
    tenant: T, limpio, resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL", checks,
  });
}
