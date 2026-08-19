export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { createOrMerge, vincularAccion, transicionar, ESTADOS_VIVOS } from "@/lib/agents";
import { generarResumenJefe } from "@/lib/agents/jefe-gabinete";

// ⚠️ ENDPOINT TEMPORAL — verifica el Paso 2A (Jefe de Gabinete + enlace
// Recommendation→ActionQueue) contra la base real. Se elimina después.
// Protegido por token. Usa un tenant aislado smoke2a-<ts> que se limpia al final.
// NO ejecuta tools ni cambia precios: solo crea recomendaciones/órdenes de prueba
// en el tenant aislado y las borra.
const TOKEN = "5f65e7525fa4c5834735eec65a94a490";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const T = `smoke2a-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);
  const e = (s: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(s, ...a);
  const vivos = ESTADOS_VIVOS.map(x => `'${x}'`).join(",");
  let limpio = false, ejemploResumen: any = null, ejemploReco: any = null;

  try {
    await ensureSchema("agentes");

    // 1. Dedup: misma dedup_key dos veces → 1 viva, 2 fuentes.
    const kd = `precio:producto:DUP-${Date.now()}`;
    const d1 = await createOrMerge({ tenantId: T, agentId: "comercial", tipo: "precio", titulo: "Dup", entityType: "producto", entityId: "DUP", dedupKey: kd, origenConfianza: "calculo" });
    const d2 = await createOrMerge({ tenantId: T, agentId: "inteligencia", tipo: "precio", titulo: "Dup", entityType: "producto", entityId: "DUP", dedupKey: kd, origenConfianza: "calculo" });
    const vivasDup: any[] = await q(`SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1 AND dedup_key=$2 AND estado IN (${vivos})`, T, kd);
    const fuentesDup: any[] = await q(`SELECT COUNT(*)::int n FROM recommendation_sources WHERE recommendation_id=$1`, d1.recommendation.id);
    push("1. Dedup: 1 recomendación viva + 2 fuentes", !d1.merged && d2.merged && vivasDup[0].n === 1 && fuentesDup[0].n === 2, `vivas=${vivasDup[0].n}, fuentes=${fuentesDup[0].n}`);

    // 2. Enlace Recommendation → ActionQueue (1:1, sin doble ejecución).
    const rlink = await createOrMerge({ tenantId: T, agentId: "comercial", tipo: "precio", titulo: "Ajuste de precio sugerido: Producto Z", descripcion: "Precio actual $1000 → sugerido $950 (-5%).", entityType: "producto", entityId: "LINK", severidad: "importante", origenConfianza: "inferencia_alta", actionTool: "aplicar_precio", actionInput: { productId: "LINK", precio: 950 }, metadata: { direccion: "baja", precioActual: 1000, pct: -5 } });
    const aq: any[] = await q(`INSERT INTO action_queue (agent_id, tool, input, estado) VALUES ($1,'aplicar_precio',$2::jsonb,'pendiente') RETURNING id`, `smoke:${T}`, JSON.stringify({ productId: "LINK", precio: 950 }));
    const aqId = Number(aq[0].id);
    const v1 = await vincularAccion(rlink.recommendation.id, aqId);
    const v2 = await vincularAccion(rlink.recommendation.id, aqId + 1);
    await transicionar(rlink.recommendation.id, "pending_approval").catch(() => {});
    push("2. Recommendation → ActionQueue 1:1 (no doble ejecución)", v1 === true && v2 === false, `aq=${aqId}, 2do_vinculo=${v2}`);
    ejemploReco = { id: rlink.recommendation.id, titulo: rlink.recommendation.titulo, action_tool: rlink.recommendation.action_tool, action_queue_id: aqId, estado_tras_vincular: "pending_approval" };

    // 3. Conflicto A: accionable con confianza < 60 → evidencia insuficiente.
    await createOrMerge({ tenantId: T, agentId: "comercial", tipo: "precio", titulo: "Bajar precio (evidencia floja)", entityType: "producto", entityId: "LOWCONF", severidad: "importante", confianza: 54, actionTool: "aplicar_precio", actionInput: { productId: "LOWCONF", precio: 800 }, metadata: { direccion: "baja" } });

    // 4. Conflicto B: bajar precio + señal de margen sobre la misma entidad.
    await createOrMerge({ tenantId: T, agentId: "comercial", tipo: "precio", titulo: "Bajar precio 12%", entityType: "producto", entityId: "CONFLICT", severidad: "importante", confianza: 85, actionTool: "aplicar_precio", actionInput: { productId: "CONFLICT", precio: 880 }, metadata: { direccion: "baja" } });
    await createOrMerge({ tenantId: T, agentId: "finanzas", tipo: "margen_bajo", titulo: "El margen actual es bajo", entityType: "producto", entityId: "CONFLICT", severidad: "importante", origenConfianza: "calculo" });

    // Una oportunidad "limpia" (sin conflicto) para que quede seleccionada.
    await createOrMerge({ tenantId: T, agentId: "compras", tipo: "stock_bajo", titulo: "Reponer yerba", entityType: "producto", entityId: "CLEAN", severidad: "critica", origenConfianza: "deterministico" });

    // 5. Jefe genera el resumen SIN IA (plantilla determinística).
    const jefe = await generarResumenJefe({ tenantId: T, usarIA: false });
    const idsSel = jefe.seleccionadas.map(s => s.entity_id);
    const tieneConflA = jefe.conflictos.some(c => c.tipo === "evidencia_insuficiente");
    const tieneConflB = jefe.conflictos.some(c => c.tipo === "contradiccion");
    const excluyeConflicto = !idsSel.includes("LOWCONF") && !idsSel.includes("CONFLICT");
    push("5. Jefe genera resumen (reglas, sin IA)", jefe.resultado === "ok" && !jefe.usoIA, `generado_por=${jefe.usoIA ? "ia" : "reglas"}${jefe.persistError ? ` · persistError=${jefe.persistError}` : ""}`);
    push("6. Detecta conflicto A (evidencia insuficiente)", tieneConflA);
    push("7. Detecta conflicto B (contradicción precio/margen)", tieneConflB);
    push("8. Recs en conflicto NO se seleccionan como prioridad", excluyeConflicto, `top=${JSON.stringify(idsSel)}`);
    ejemploResumen = { resultado: jefe.resultado, conteos: jefe.conteos, seleccionadas: jefe.seleccionadas.map(s => s.titulo), conflictos: jefe.conflictos.map(c => c.motivo), texto: jefe.resumen };

    // 9. Auditoría: la fila jefe_resumen quedó persistida con los campos clave.
    const jr: any[] = await q(`SELECT consideradas, conflictos, conteos, agentes, generado_por, resultado FROM jefe_resumen WHERE tenant_id=$1 ORDER BY generado_en DESC LIMIT 1`, T);
    const row = jr[0];
    let diag = "";
    if (!row) {
      const tot: any[] = await q(`SELECT COUNT(*)::int n FROM jefe_resumen`);
      const ult: any[] = await q(`SELECT tenant_id, fecha::text FROM jefe_resumen ORDER BY generado_en DESC LIMIT 3`);
      diag = ` · fecha_usada=${jefe.fecha} · total_filas=${tot[0].n} · ultimas=${JSON.stringify(ult)}`;
    }
    push("9. jefe_resumen persistido (auditable)", !!row && Array.isArray(row.consideradas) && row.generado_por === "reglas", row ? `consideradas=${row.consideradas.length}, conflictos=${(row.conflictos ?? []).length}` : `sin fila${diag}`);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    try {
      await e(`DELETE FROM recommendation_sources WHERE recommendation_id IN (SELECT id FROM recommendations WHERE tenant_id=$1)`, T);
      await e(`DELETE FROM recommendations WHERE tenant_id=$1`, T);
      await e(`DELETE FROM action_queue WHERE agent_id=$1`, `smoke:${T}`);
      await e(`DELETE FROM jefe_resumen WHERE tenant_id=$1`, T);
      const rest: any[] = await q(`SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1`, T);
      limpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter(c => c.ok).length;
  return NextResponse.json({
    tenant: T, limpio, resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL",
    ejemplo_resumen_jefe: ejemploResumen, ejemplo_reco_comercial: ejemploReco, checks,
  });
}
