export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { createOrMerge, ESTADOS_VIVOS } from "@/lib/agents";
import { clasificarConversacion, intencionCompra, analizarConversacion } from "@/lib/agents/whatsapp-intel.logic";
import { conversacionesPriorizadas } from "@/lib/services/whatsapp.service";

// ⚠️ ENDPOINT TEMPORAL — verifica la Fase 5D (WhatsApp inteligente) contra la
// base real. Se elimina después. Solo lectura + una recomendación en tenant
// aislado (se limpia). No envía mensajes ni toca datos de negocio.
const TOKEN = "411370a0135be16ebcc3a0418f2c0107";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const T = `smoke5d-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);
  const e = (s: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(s, ...a);
  const vivos = ESTADOS_VIVOS.map(x => `'${x}'`).join(",");
  let limpio = false;

  try {
    await ensureSchema("agentes");

    // 1. El pipeline de priorización corre sobre datos reales (puede venir vacío).
    const convs = await conversacionesPriorizadas(15);
    const ok1 = Array.isArray(convs) && convs.every(c => typeof c.intencion === "number" && typeof c.tipo === "string");
    push("1. conversaciones_priorizadas ejecuta (datos reales)", ok1, `conversaciones=${convs.length}`);

    // 2. Clasificación (función real): pedido / precio / reclamo.
    push("2. Clasificación por reglas (pedido/precio/reclamo)",
      clasificarConversacion("quiero comprar 3 mates") === "pedido" &&
      clasificarConversacion("cuánto sale?") === "precio" &&
      clasificarConversacion("llegó roto, quiero devolución") === "reclamo");

    // 3. Intención de compra (0-100): alta cuando quiere comprar, 0 en reclamo.
    const iAlta = intencionCompra("quiero comprar, tenés stock para hoy?");
    const iReclamo = intencionCompra("tengo un reclamo, no funciona");
    push("3. Intención de compra 0-100 (alta vs reclamo)", iAlta >= 60 && iReclamo === 0, `alta=${iAlta}, reclamo=${iReclamo}`);

    // 4. Recomendación de conversación priorizada persistida (entidad contacto).
    const a = analizarConversacion("549110000000", "quiero comprar 2 mates, cuánto sale?");
    const { recommendation } = await createOrMerge({
      tenantId: T, agentId: "whatsapp", tipo: `whatsapp:${a.tipo}`,
      severidad: a.intencion >= 50 ? "importante" : "oportunidad",
      titulo: `Responder ${a.wa_id} — ${a.tipo} (intención ${a.intencion})`,
      descripcion: 'Cliente: "quiero comprar 2 mates, cuánto sale?"',
      entityType: "contacto", entityId: a.wa_id, confianza: a.intencion, origenConfianza: "inferencia_media",
    });
    const grp: any[] = await q(
      `SELECT COUNT(*)::int n FROM recommendations WHERE tenant_id=$1 AND entity_type='contacto' AND estado IN (${vivos})`, T);
    push("4. Recomendación de conversación persistida (entidad contacto)",
      recommendation.entity_type === "contacto" && recommendation.confianza === a.intencion && grp[0].n >= 1,
      `tipo=${a.tipo}, intencion=${a.intencion}, id=${recommendation.id}`);
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
