export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { createOrMerge, ESTADOS_VIVOS } from "@/lib/agents";
import { analisisRentabilidad } from "@/lib/services/finanzas.service";
import { clasificarRentabilidad } from "@/lib/agents/rentabilidad.logic";

// ⚠️ ENDPOINT TEMPORAL — verifica la Fase 5A (Rentabilidad en Finanzas) contra
// la base real. Se elimina después. Finanzas es de solo lectura (no cambia
// datos). Las recomendaciones que genere la corrida se limpian; el tenant de
// prueba también.
const TOKEN = "3793eff9b25f33ce482d3b7ed7644760";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const T = `smoke5a-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);
  const e = (s: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(s, ...a);
  const vivos = ESTADOS_VIVOS.map(x => `'${x}'`).join(",");
  let limpio = false, ejemplos: any = null;

  try {
    await ensureSchema("agentes");

    // 1. El análisis de rentabilidad lee datos reales (solo lectura).
    const items = await analisisRentabilidad();
    push("1. analisis_rentabilidad devuelve datos", Array.isArray(items), `productos=${items.length}`);
    ejemplos = items.slice(0, 3).map(i => ({ nombre: i.nombre, margen_pct: i.margen_pct, ventas_30d: i.ventas_30d, inmovilizado: i.valor_inmovilizado }));

    // 2. La clasificación (función real) detecta el caso "vende mucho, deja poco".
    const a = clasificarRentabilidad({ id: "X", nombre: "Mate Test", precio: 1000, costo: 890, margen_pct: 11, ventas_30d: 25, stock: 5, valor_inmovilizado: 4450 });
    push("2. Clasificación: alta rotación + margen bajo → importante", a?.tipo === "margen_bajo" && a?.severidad === "importante", `tipo=${a?.tipo}`);

    // 3. Sobre los datos REALES hay candidatos que Finanzas emitiría (top 15).
    //    (No corremos el agente completo acá: la query de rentabilidad es pesada
    //     y correrla dos veces excede el límite de Vercel. La emisión real se
    //     valida en el check 4 con createOrMerge, que es el mismo primitivo.)
    const candidatos = items.filter(i => clasificarRentabilidad(i) != null);
    push("3. Datos reales producen candidatos de rentabilidad (top 15 a emitir)",
      candidatos.length > 0, `candidatos=${candidatos.length} · a_emitir=${Math.min(candidatos.length, 15)}`);

    // 4. Una recomendación de rentabilidad se persiste agrupable (tenant aislado).
    const { recommendation } = await createOrMerge({
      tenantId: T, agentId: "finanzas", tipo: "rentabilidad:inmovilizado",
      titulo: "Inmovilizado: Producto Z", descripcion: "$500.000 en stock sin ventas.",
      severidad: "importante", entityType: "producto", entityId: "SMOKE5A",
      impactoEstimado: 500000, origenConfianza: "calculo",
    });
    const grp: any[] = await q(
      `SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1 AND severidad='importante' AND estado IN (${vivos})`, T);
    push("4. Recomendación de rentabilidad persistida (impacto real)",
      recommendation.impacto_estimado === 500000 && grp[0].n >= 1, `id=${recommendation.id}`);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    try {
      // Limpia lo del tenant aislado (solo tocamos ese tenant).
      await e(`DELETE FROM recommendation_sources WHERE recommendation_id IN (SELECT id FROM recommendations WHERE tenant_id=$1)`, T);
      await e(`DELETE FROM recommendations WHERE tenant_id=$1`, T);
      const rest: any[] = await q(`SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1`, T);
      limpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter(c => c.ok).length;
  return NextResponse.json({
    tenant: T, limpio, resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL", ejemplos_rentabilidad: ejemplos, checks,
  });
}
