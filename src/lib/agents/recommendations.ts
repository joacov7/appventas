import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import {
  ESTADOS_VIVOS, calcularPrioridad, calcularValorEsperado, confianzaPorOrigen,
  dedupKey, puedeTransicionar,
} from "./recommendations.logic";
import type { EstadoReco, Severidad, OrigenConfianza, Evidencia } from "./recommendations.logic";

// ─── Recomendaciones: la entidad central de inteligencia del sistema ─────────
//
// Arquitectura objetivo (esta pieza es el segundo eslabón):
//   Agent Run → Recommendation → Action → Result → Impact → Memory
//
// Reglas de diseño:
//   • Recommendation = intención / hallazgo.   action_queue = orden ejecutable.
//   • Una recomendación apunta a lo sumo a UNA fila de action_queue
//     (columna action_queue_id) → nunca genera dos ejecuciones.
//   • Determinístico y matemático primero; la IA no interviene acá.
//   • No inventar datos: si falta información, se refleja como "sin estimación"
//     y baja la prioridad, en vez de fabricar una falsa precisión.
//
// La lógica pura (estados, prioridad, severidad, confianza, valor esperado,
// dedup) vive en ./recommendations.logic para poder testearla sin DB.

const TENANT_DEFAULT = "default";

// Re-exporta la lógica pura + tipos para que el resto del sistema importe todo
// desde "@/lib/agents/recommendations".
export {
  ESTADOS_VIVOS, calcularPrioridad, calcularValorEsperado, confianzaPorOrigen,
  dedupKey, puedeTransicionar,
} from "./recommendations.logic";
export type { EstadoReco, Severidad, OrigenConfianza, Evidencia } from "./recommendations.logic";

// ─── Entrada para crear/mergear una recomendación ───────────────────────────
export interface RecommendationInput {
  agentId: string;
  agentRunId?: number | null;
  tipo: string;
  titulo: string;
  descripcion?: string;
  severidad?: Severidad;
  impactoEstimado?: number | null;
  confianza?: number | null;
  origenConfianza?: OrigenConfianza; // alternativa a `confianza` explícita
  probabilidad?: number | null;      // para valor esperado
  margen?: number | null;            // para valor esperado
  esfuerzoEstimado?: string;
  evidencia?: Evidencia;
  entityType?: string | null;
  entityId?: string | null;
  actionTool?: string | null;
  actionInput?: any;
  // dedup_key explícita. Si se omite, se deriva de tipo+entidad.
  // Pasar `null` fuerza a NO deduplicar (siempre crea nueva).
  dedupKey?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, any>;
  tenantId?: string;
  aporte?: Record<string, any>; // qué aportó este agente (para la fila source)
}

export interface Recommendation {
  id: number;
  agent_id: string;
  agent_run_id: number | null;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  prioridad: number | null;
  severidad: Severidad;
  impacto_estimado: number | null;
  valor_esperado: number | null;
  confianza: number | null;
  estado: EstadoReco;
  dedup_key: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_tool: string | null;
  action_input: any;
  action_queue_id: number | null;
  evidencia: Evidencia | null;
  created_at: string;
  updated_at: string;
}

async function ensure() { await ensureSchema("agentes"); }

// Deriva confianza final: la explícita gana; si no, la del origen; default 50.
function resolverConfianza(i: RecommendationInput): number | null {
  if (i.confianza != null) return Math.max(0, Math.min(100, Math.round(i.confianza)));
  if (i.origenConfianza) return confianzaPorOrigen(i.origenConfianza);
  return null;
}

// Rango numérico de severidad (para el merge atómico en SQL).
const RANK_SEVERIDAD: Record<Severidad, number> = { critica: 3, importante: 2, oportunidad: 1 };

// ─── createOrMerge ──────────────────────────────────────────────────────────
// SEGURO ANTE CONCURRENCIA. Se apoya en el índice único parcial
// ux_reco_dedup_activo (tenant_id, dedup_key WHERE estado IN vivos) y en una
// ÚNICA sentencia atómica `INSERT ... ON CONFLICT DO UPDATE`:
//   • si no existe una recomendación viva con esa clave → la crea;
//   • si ya existe (incluso por una inserción simultánea) → la mergea
//     (sube severidad/confianza al máximo, completa impacto/valor esperado y
//     recalcula prioridad) en vez de fallar por UNIQUE violation.
// Así dos agentes que corren a la vez con la misma dedup_key NUNCA pierden una
// recomendación ni crean un duplicado. Siempre se registra la fuente (agente).
//
// IMPORTANTE: las expresiones de merge en SQL espejan la lógica pura de
// recommendations.logic (severidadMax / GREATEST de confianza / calcularPrioridad).
// Si se cambia una, actualizar la otra (hay tests que fijan la fórmula).
export async function createOrMerge(
  input: RecommendationInput
): Promise<{ recommendation: Recommendation; merged: boolean }> {
  await ensure();
  const tenant = input.tenantId ?? TENANT_DEFAULT;
  const severidad: Severidad = input.severidad ?? "oportunidad";
  const confianza = resolverConfianza(input);
  const valorEsperado = calcularValorEsperado({
    impacto: input.impactoEstimado, probabilidad: input.probabilidad, margen: input.margen,
  });
  const prioridad = calcularPrioridad({ severidad, confianza, valorEsperado });
  const estadoInicial = input.actionTool ? "proposed" : "new";
  const key = input.dedupKey === undefined
    ? dedupKey({ tipo: input.tipo, entityType: input.entityType, entityId: input.entityId })
    : input.dedupKey;

  const cols = `(tenant_id, agent_id, agent_run_id, tipo, titulo, descripcion, prioridad,
        severidad, impacto_estimado, valor_esperado, confianza, esfuerzo_estimado,
        evidencia, estado, dedup_key, entity_type, entity_id, action_tool, action_input,
        expires_at, metadata)`;
  const vals = `($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19::jsonb,$20,$21::jsonb)`;
  const args = [
    tenant, input.agentId, input.agentRunId ?? null, input.tipo, input.titulo,
    input.descripcion ?? null, prioridad, severidad, input.impactoEstimado ?? null,
    valorEsperado, confianza, input.esfuerzoEstimado ?? null,
    JSON.stringify(input.evidencia ?? null),
    estadoInicial, key, input.entityType ?? null,
    input.entityId ?? null, input.actionTool ?? null,
    JSON.stringify(input.actionInput ?? null), input.expiresAt ?? null,
    JSON.stringify(input.metadata ?? null),
  ];

  let sql: string;
  if (key) {
    const vivos = ESTADOS_VIVOS.map(e => `'${e}'`).join(",");
    const sevRankNew = RANK_SEVERIDAD[severidad];
    const rankEx = `(CASE recommendations.severidad WHEN 'critica' THEN 3 WHEN 'importante' THEN 2 ELSE 1 END)`;
    const mSev = `(CASE WHEN ${sevRankNew} > ${rankEx} THEN EXCLUDED.severidad ELSE recommendations.severidad END)`;
    const mConf = `NULLIF(GREATEST(COALESCE(recommendations.confianza,0), COALESCE(EXCLUDED.confianza,0)), 0)`;
    const mVE = `COALESCE(recommendations.valor_esperado, EXCLUDED.valor_esperado)`;
    const mImp = `COALESCE(recommendations.impacto_estimado, EXCLUDED.impacto_estimado)`;
    const baseSev = `(CASE ${mSev} WHEN 'critica' THEN 1 WHEN 'importante' THEN 2 ELSE 3 END)`;
    const mPri = `LEAST(5, GREATEST(1, ${baseSev}
        + (CASE WHEN ${mVE} IS NULL THEN 1 ELSE 0 END)
        + (CASE WHEN COALESCE(${mConf},0) < 50 THEN 1 ELSE 0 END)
        - (CASE WHEN COALESCE(${mVE},0) > 0 AND COALESCE(${mConf},0) >= 80 THEN 1 ELSE 0 END)))`;
    sql = `INSERT INTO recommendations ${cols} VALUES ${vals}
      ON CONFLICT (tenant_id, dedup_key) WHERE dedup_key IS NOT NULL AND estado IN (${vivos})
      DO UPDATE SET
        severidad = ${mSev},
        confianza = ${mConf},
        impacto_estimado = ${mImp},
        valor_esperado = ${mVE},
        prioridad = ${mPri},
        updated_at = now()
      RETURNING *, (xmax = 0) AS _inserted`;
  } else {
    // Sin dedup_key: siempre crea (no hay agrupación posible).
    sql = `INSERT INTO recommendations ${cols} VALUES ${vals} RETURNING *, true AS _inserted`;
  }

  const rows: any[] = await (prisma as any).$queryRawUnsafe(sql, ...args);
  const row = rows[0];
  const inserted = row._inserted === true || row._inserted === "t";
  const reco = mapRow(row);
  await registrarFuente(reco.id, input);
  return { recommendation: reco, merged: !inserted };
}

async function registrarFuente(recoId: number, input: RecommendationInput): Promise<void> {
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO recommendation_sources (recommendation_id, agent_id, agent_run_id, aporte)
     VALUES ($1,$2,$3,$4::jsonb)
     ON CONFLICT (recommendation_id, agent_id) DO UPDATE SET aporte = EXCLUDED.aporte`,
    recoId, input.agentId, input.agentRunId ?? null,
    JSON.stringify(input.aporte ?? input.evidencia ?? null)).catch(() => {});
}

// ─── transicionar ───────────────────────────────────────────────────────────
// Cambia el estado validando la máquina de transiciones (server-side).
export async function transicionar(
  id: number, hacia: EstadoReco, patch?: { actionQueueId?: number | null }
): Promise<{ ok: boolean; error?: string; recommendation?: Recommendation }> {
  await ensure();
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM recommendations WHERE id = $1`, id);
  if (!rows[0]) return { ok: false, error: "Recomendación no encontrada" };
  const actual = rows[0].estado as EstadoReco;
  if (actual === hacia) return { ok: true, recommendation: mapRow(rows[0]) };
  if (!puedeTransicionar(actual, hacia)) {
    return { ok: false, error: `Transición inválida: ${actual} → ${hacia}` };
  }
  const upd: any[] = await (prisma as any).$queryRawUnsafe(
    `UPDATE recommendations
        SET estado = $2, updated_at = now(),
            action_queue_id = COALESCE($3, action_queue_id)
      WHERE id = $1 RETURNING *`,
    id, hacia, patch?.actionQueueId ?? null);
  return { ok: true, recommendation: mapRow(upd[0]) };
}

// Vincula la recomendación con su orden ejecutable (action_queue). Garantiza
// 1↔1: no piso un vínculo existente (evita doble ejecución).
export async function vincularAccion(id: number, actionQueueId: number): Promise<boolean> {
  await ensure();
  const r: any[] = await (prisma as any).$queryRawUnsafe(
    `UPDATE recommendations SET action_queue_id = $2, updated_at = now()
      WHERE id = $1 AND action_queue_id IS NULL RETURNING id`, id, actionQueueId);
  return r.length > 0;
}

// ─── Consultas para el Centro de Decisiones (se usarán en la fase de UI) ─────
export async function listar(filtro?: {
  estados?: EstadoReco[]; severidad?: Severidad; agentId?: string; limit?: number;
  tenantId?: string;
}): Promise<Recommendation[]> {
  await ensure();
  const tenant = filtro?.tenantId ?? TENANT_DEFAULT;
  const cond = ["tenant_id = $1"]; const args: any[] = [tenant]; let i = 2;
  if (filtro?.estados?.length) {
    cond.push(`estado = ANY($${i++})`); args.push(filtro.estados);
  }
  if (filtro?.severidad) { cond.push(`severidad = $${i++}`); args.push(filtro.severidad); }
  if (filtro?.agentId)   { cond.push(`agent_id = $${i++}`); args.push(filtro.agentId); }
  const limit = Math.min(Math.max(filtro?.limit ?? 100, 1), 500);
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM recommendations WHERE ${cond.join(" AND ")}
        ORDER BY prioridad ASC NULLS LAST, valor_esperado DESC NULLS LAST, created_at DESC
        LIMIT ${limit}`, ...args);
    return rows.map(mapRow);
  } catch { return []; }
}

export async function fuentesDe(recoId: number): Promise<any[]> {
  await ensure();
  try {
    return await (prisma as any).$queryRawUnsafe(
      `SELECT agent_id, agent_run_id, aporte, created_at
         FROM recommendation_sources WHERE recommendation_id = $1 ORDER BY created_at ASC`, recoId);
  } catch { return []; }
}

function mapRow(r: any): Recommendation {
  return {
    id: Number(r.id), agent_id: r.agent_id,
    agent_run_id: r.agent_run_id != null ? Number(r.agent_run_id) : null,
    tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion,
    prioridad: r.prioridad != null ? Number(r.prioridad) : null,
    severidad: r.severidad, impacto_estimado: r.impacto_estimado != null ? Number(r.impacto_estimado) : null,
    valor_esperado: r.valor_esperado != null ? Number(r.valor_esperado) : null,
    confianza: r.confianza != null ? Number(r.confianza) : null,
    estado: r.estado, dedup_key: r.dedup_key, entity_type: r.entity_type, entity_id: r.entity_id,
    action_tool: r.action_tool, action_input: r.action_input,
    action_queue_id: r.action_queue_id != null ? Number(r.action_queue_id) : null,
    evidencia: r.evidencia ?? null, created_at: r.created_at, updated_at: r.updated_at,
  };
}
