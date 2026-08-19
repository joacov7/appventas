export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { ESTADOS_VIVOS, transicionar, marcarResultadoAccion, editarAccionInput } from "@/lib/agents/recommendations";
import { aprobarAccion, rechazarAccion } from "@/lib/agents/acciones-exec";
import { recordarDecision } from "@/lib/agents/memoria-estructurada";

const vivosSql = ESTADOS_VIVOS.map(e => `'${e}'`).join(",");

// GET → recomendaciones vivas AGRUPADAS por severidad (para el Centro de
// Decisiones), con los agentes que las detectaron (fuentes).
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureSchema("agentes");
  const sp = req.nextUrl.searchParams;
  const agente = sp.get("agente") || undefined;

  const cond = [`r.tenant_id = 'default'`, `r.estado IN (${vivosSql})`];
  const args: any[] = [];
  if (agente) { args.push(agente); cond.push(`r.agent_id = $${args.length}`); }

  let rows: any[] = [];
  try {
    rows = await (prisma as any).$queryRawUnsafe(
      `SELECT r.*, COALESCE(
          (SELECT array_agg(DISTINCT s.agent_id) FROM recommendation_sources s WHERE s.recommendation_id = r.id),
          ARRAY[r.agent_id]
        ) AS agentes
       FROM recommendations r
       WHERE ${cond.join(" AND ")}
       ORDER BY r.prioridad ASC NULLS LAST, r.valor_esperado DESC NULLS LAST, r.created_at DESC`,
      ...args);
  } catch { rows = []; }

  const map = (r: any) => ({
    id: Number(r.id), agent_id: r.agent_id, tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion,
    prioridad: r.prioridad != null ? Number(r.prioridad) : null, severidad: r.severidad,
    impacto_estimado: r.impacto_estimado != null ? Number(r.impacto_estimado) : null,
    valor_esperado: r.valor_esperado != null ? Number(r.valor_esperado) : null,
    confianza: r.confianza != null ? Number(r.confianza) : null,
    estado: r.estado, entity_type: r.entity_type, entity_id: r.entity_id,
    action_tool: r.action_tool, action_input: r.action_input,
    action_queue_id: r.action_queue_id != null ? Number(r.action_queue_id) : null,
    evidencia: r.evidencia ?? null, agentes: Array.isArray(r.agentes) ? r.agentes : [r.agent_id],
    created_at: r.created_at,
  });
  const items = rows.map(map);
  return NextResponse.json({
    total: items.length,
    criticas: items.filter(i => i.severidad === "critica"),
    importantes: items.filter(i => i.severidad === "importante"),
    oportunidades: items.filter(i => i.severidad === "oportunidad"),
  });
}

// PATCH → transición de una recomendación: aprobar | editar | rechazar | posponer.
// Server-side. Si la recomendación tiene una acción vinculada (action_queue_id),
// reutiliza el flujo de acciones (con enforcement del Paso 4) y refleja el
// resultado en la recomendación. Vínculo 1:1 → nunca doble ejecución.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureSchema("agentes");
  const { id, decision, input } = await req.json();
  if (!id || !["aprobar", "editar", "rechazar", "posponer"].includes(decision)) {
    return NextResponse.json({ error: "id y decision (aprobar|editar|rechazar|posponer) requeridos" }, { status: 400 });
  }

  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM recommendations WHERE id = $1`, Number(id));
  const reco = rows[0];
  if (!reco) return NextResponse.json({ error: "Recomendación no encontrada" }, { status: 404 });
  const aqId = reco.action_queue_id != null ? Number(reco.action_queue_id) : null;

  // ── Rechazar ──
  if (decision === "rechazar") {
    if (aqId) await rechazarAccion(aqId);
    const t = await transicionar(Number(id), "rejected");
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: 409 });
    // Aprendizaje (Fase 4): registra la decisión del usuario para que los agentes
    // no re-propongan esta acción sobre esta entidad mientras esté vigente.
    if (reco.action_tool && reco.entity_type && reco.entity_id) {
      await recordarDecision({
        actor: "usuario", accion: reco.action_tool,
        entityType: reco.entity_type, entityId: reco.entity_id,
        motivo: typeof input?.motivo === "string" ? input.motivo : "rechazada en el Centro de Decisiones",
        vigenciaDias: 30, kind: "rechazo",
      });
    }
    return NextResponse.json({ ok: true, estado: "rejected" });
  }

  // ── Posponer ──
  if (decision === "posponer") {
    const t = await transicionar(Number(id), "postponed");
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: 409 });
    return NextResponse.json({ ok: true, estado: "postponed" });
  }

  // ── Editar el input propuesto (sin ejecutar) ──
  if (decision === "editar") {
    if (!input || typeof input !== "object") {
      return NextResponse.json({ error: "input requerido para editar" }, { status: 400 });
    }
    await editarAccionInput(Number(id), input);
    if (aqId) {
      await (prisma as any).$executeRawUnsafe(
        `UPDATE action_queue SET input = $2::jsonb WHERE id = $1 AND estado = 'pendiente'`,
        aqId, JSON.stringify(input));
    }
    return NextResponse.json({ ok: true, estado: reco.estado, editado: true });
  }

  // ── Aprobar ──
  if (aqId) {
    // Con acción vinculada → ejecuta vía el flujo compartido (enforcement).
    const r = await aprobarAccion(aqId, input);
    if (r.estado === "no_encontrada") {
      return NextResponse.json({ error: "La acción ya fue resuelta", estado: reco.estado }, { status: 409 });
    }
    if (r.estado === "bloqueada") {
      return NextResponse.json({ error: `Bloqueado por política: ${r.motivo}`, motivo: r.motivo }, { status: 422 });
    }
    await marcarResultadoAccion(Number(id), r.ok);
    return NextResponse.json({ ok: r.ok, estado: r.ok ? "executed" : "failed", resultado: r.resultado });
  }

  // Recomendación informativa (sin acción) → aprobar = marcarla como atendida.
  await marcarResultadoAccion(Number(id), true);
  return NextResponse.json({ ok: true, estado: "executed", informativa: true });
}
