export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import {
  gastoDelMesAgente, nivelAlerta, resolverFeature, AIBudgetExceededError,
} from "@/lib/ai";
import { verificarPresupuestoAgente } from "@/lib/ai/gasto";

// ⚠️ ENDPOINT TEMPORAL — verifica el gateway de IA y el presupuesto por agente
// (Paso 5) contra la base real. Se elimina después. Protegido por token. NO
// llama a la IA real: prueba la capa de atribución/presupuesto insertando filas
// de gasto con un agente ficticio "__smoke5__" que se limpian al final.
const TOKEN = "1a35e34ff7c39f1fe127f608ac1e9732";
const AG = "__smoke5__";
const FEAT = `agente:${AG}`;

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (sql: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(sql, ...a);
  const e = (sql: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(sql, ...a);
  let limpio = false;

  try {
    await ensureSchema("ia");

    // 0. Atribución: resolverFeature (pura, pero la verificamos igual).
    push("0. resolverFeature agentId→agente:<id>", resolverFeature({ agentId: AG }) === FEAT);

    // 1. Atribución en la base: registro 2 gastos del agente y los recupera.
    await e(`INSERT INTO ai_gasto (feature, model, costo_usd) VALUES ($1,'test',0.02)`, FEAT);
    await e(`INSERT INTO ai_gasto (feature, model, costo_usd) VALUES ($1,'test',0.03)`, FEAT);
    const gastado = await gastoDelMesAgente(AG);
    push("1. Gasto atribuido al agente (agente:<id>)", Math.abs(gastado - 0.05) < 1e-6, `gastado=${gastado}`);

    // 2. Alertas 50/80/100 sobre el gasto real.
    const a50 = nivelAlerta(gastado, 0.10); // 50%
    const a80 = nivelAlerta(gastado, 0.0625); // 80%
    const a100 = nivelAlerta(gastado, 0.05); // 100%
    push("2. Alertas 50/80/100", a50.nivel === "informativa" && a80.nivel === "advertencia" && a100.nivel === "bloqueo",
      `50→${a50.nivel}, 80→${a80.nivel}, 100→${a100.nivel}`);

    // 3. Corte por tope de agente: cortar=true y gastado ≥ límite → lanza.
    let corto = false;
    try {
      await verificarPresupuestoAgente(AG, { limite_usd: 0, cortar: true, porAgente: { [AG]: 0.01 } });
    } catch (err) { corto = err instanceof AIBudgetExceededError; }
    push("3. Corta al superar el tope del agente", corto);

    // 4. Con límite amplio NO corta.
    let cortoAmplio = false;
    try {
      await verificarPresupuestoAgente(AG, { limite_usd: 0, cortar: true, porAgente: { [AG]: 100 } });
    } catch { cortoAmplio = true; }
    push("4. No corta si está dentro del tope", !cortoAmplio);

    // 5. Con cortar=false NO corta aunque esté excedido (solo informa).
    let cortoSinCortar = false;
    try {
      await verificarPresupuestoAgente(AG, { limite_usd: 0, cortar: false, porAgente: { [AG]: 0.01 } });
    } catch { cortoSinCortar = true; }
    push("5. cortar=false no bloquea (solo alerta)", !cortoSinCortar);

    // 6. Agente sin tope propio → nunca corta (determinísticos incluidos).
    let cortoSinTope = false;
    try {
      await verificarPresupuestoAgente("finanzas", { limite_usd: 0, cortar: true, porAgente: {} });
    } catch { cortoSinTope = true; }
    push("6. Agente sin tope propio no se ve afectado", !cortoSinTope);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    try {
      await e(`DELETE FROM ai_gasto WHERE feature = $1`, FEAT);
      const rest: any[] = await q(`SELECT COUNT(*)::int AS n FROM ai_gasto WHERE feature = $1`, FEAT);
      limpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter(c => c.ok).length;
  return NextResponse.json({
    limpio, resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL", checks,
  });
}
