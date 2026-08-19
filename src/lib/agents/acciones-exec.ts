import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { registry } from "@/lib/tools";
import { remember } from "@/lib/memory";
import { enforceWrite, registrarAccion } from "./policies";

// ─── Ejecución de acciones aprobadas (server-side, único punto) ──────────────
// Compartido por /api/agentes/acciones (Aprobaciones) y por el Centro de
// Decisiones (/api/agentes/recomendaciones). Garantiza que el enforcement del
// Paso 4 se aplique SIEMPRE al aprobar, y que una acción pendiente se resuelva
// una sola vez (estado 'pendiente' → 'ejecutada'/'error'/'rechazada').

export interface ResultadoAprobacion {
  ok: boolean;
  estado: "ejecutada" | "error" | "rechazada" | "bloqueada" | "no_encontrada";
  motivo?: string;
  resultado?: any;
}

async function cargarPendiente(id: number): Promise<any | null> {
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM action_queue WHERE id = $1 AND estado = 'pendiente'`, id);
  return rows[0] ?? null;
}

// Aprueba y EJECUTA una acción encolada (con enforcement). inputEditado permite
// editar el input antes de ejecutar.
export async function aprobarAccion(id: number, inputEditado?: any): Promise<ResultadoAprobacion> {
  await ensureSchema("agentes");
  const accion = await cargarPendiente(id);
  if (!accion) return { ok: false, estado: "no_encontrada", motivo: "Acción no encontrada o ya resuelta" };

  const inputFinal = (inputEditado && typeof inputEditado === "object") ? inputEditado : (accion.input ?? {});

  // Enforcement server-side también al aprobar (límites duros de negocio).
  const verdict = await enforceWrite({
    agentId: accion.agent_id ?? "desconocido", tool: accion.tool,
    input: inputFinal, agentAutonomy: "autonomous",
  });
  if (!verdict.allow) {
    return { ok: false, estado: "bloqueada", motivo: verdict.motivo };
  }

  const result = await registry.execute(accion.tool, inputFinal);
  const entityId = inputFinal?.productId ?? inputFinal?.clientId ?? inputFinal?.to ?? null;
  if (result.ok) {
    await registrarAccion({ agentId: accion.agent_id, tool: accion.tool, modo: "ejecutada", entityId: entityId != null ? String(entityId) : null });
  }
  await (prisma as any).$executeRawUnsafe(
    `UPDATE action_queue SET estado = $2, resultado = $3::jsonb, input = $4::jsonb, resuelto_en = now() WHERE id = $1`,
    id, result.ok ? "ejecutada" : "error", JSON.stringify(result), JSON.stringify(inputFinal));
  if (result.ok) {
    remember({
      namespace: "decisiones", kind: "accion_aprobada", key: `accion:${id}`,
      value: { agente: accion.agent_id, tool: accion.tool, input: inputFinal },
      source: "decisiones", tags: ["aprobada", accion.tool], confidence: 0.8,
    }).catch(() => {});
  }
  return { ok: result.ok, estado: result.ok ? "ejecutada" : "error", resultado: result };
}

// Rechaza una acción encolada (no la ejecuta).
export async function rechazarAccion(id: number): Promise<ResultadoAprobacion> {
  await ensureSchema("agentes");
  const accion = await cargarPendiente(id);
  if (!accion) return { ok: false, estado: "no_encontrada", motivo: "Acción no encontrada o ya resuelta" };
  await (prisma as any).$executeRawUnsafe(
    `UPDATE action_queue SET estado = 'rechazada', resuelto_en = now() WHERE id = $1`, id);
  remember({
    namespace: "decisiones", kind: "accion_rechazada", key: `accion:${id}`,
    value: { agente: accion.agent_id, tool: accion.tool, input: accion.input },
    source: "decisiones", tags: ["rechazada", accion.tool], confidence: 0.7,
  }).catch(() => {});
  return { ok: true, estado: "rechazada" };
}
