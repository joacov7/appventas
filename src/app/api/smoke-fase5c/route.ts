export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { createOrMerge, ESTADOS_VIVOS } from "@/lib/agents";
import { detectarVentaCruzada } from "@/lib/agents/oportunidades.logic";
import { oportunidadesVentaCruzada, paresComplementarios } from "@/lib/services/oportunidades.service";

// ⚠️ ENDPOINT TEMPORAL — verifica la Fase 5C (venta cruzada) contra la base real.
// Se elimina después. Solo lectura + una recomendación en tenant aislado (se limpia).
const TOKEN = "d7b512561d61a72f17e97ae84f1ad297";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const T = `smoke5c-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);
  const e = (s: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(s, ...a);
  const vivos = ESTADOS_VIVOS.map(x => `'${x}'`).join(",");
  let limpio = false;

  try {
    await ensureSchema("agentes");

    // 1. El pipeline de venta cruzada corre sobre datos reales (puede venir vacío
    //    si falta historia de canasta — se reporta honestamente).
    const pares = await paresComplementarios();
    const ops = await oportunidadesVentaCruzada();
    push("1. Pipeline de venta cruzada ejecuta (datos reales)", Array.isArray(pares) && Array.isArray(ops),
      `pares=${pares.length} · oportunidades=${ops.length}`);

    // 2. La lógica de matcheo (función real) sugiere el complementario que falta.
    const out = detectarVentaCruzada(
      [{ a: "mate", b: "bombilla", nombre_a: "Mate", nombre_b: "Bombilla", co: 6 }],
      [{ email: "a@x.com", nombre: "Ana", productos: ["mate"] }]);
    push("2. Matcheo: compró mate → sugiere bombilla (co=6, conf 80)",
      out.length === 1 && out[0].sugerido === "bombilla" && out[0].confianza === 80,
      `sugerido=${out[0]?.sugerido}, conf=${out[0]?.confianza}`);

    // 3. No sugiere lo que ya tiene.
    const out2 = detectarVentaCruzada(
      [{ a: "mate", b: "bombilla", nombre_a: "Mate", nombre_b: "Bombilla", co: 6 }],
      [{ email: "a@x.com", nombre: "Ana", productos: ["mate", "bombilla"] }]);
    push("3. No sugiere lo que el cliente ya compró", out2.length === 0);

    // 4. Recomendación de venta cruzada persistida (entidad cliente, con evidencia).
    const { recommendation } = await createOrMerge({
      tenantId: T, agentId: "oportunidades", tipo: "venta_cruzada", severidad: "oportunidad",
      titulo: 'Venta cruzada: ofrecer "Bombilla Alpaca" a Ana',
      descripcion: "Compró un producto que suele ir junto (6 veces). No lo compró aún.",
      entityType: "cliente", entityId: "SMOKE5C-C", confianza: 80, origenConfianza: "inferencia_media",
      evidencia: { observado: { co_ocurrencias: 6 }, inferencia: "correlación de canasta, no causalidad" },
    });
    const grp: any[] = await q(
      `SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1 AND entity_type='cliente' AND estado IN (${vivos})`, T);
    push("4. Recomendación de venta cruzada persistida (entidad cliente)",
      recommendation.entity_type === "cliente" && recommendation.confianza === 80 && grp[0].n >= 1, `id=${recommendation.id}`);
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
    veredicto: pass === checks.length ? "PASS" : "FAIL", checks,
  });
}
