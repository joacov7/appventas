import { remember, recall } from "@/lib/memory";
import {
  MEM_NS, estaVigente, claveDecision, decisionBloqueante, vencimientoEnDias,
} from "./memoria-estructurada.logic";
import type { DecisionValue, MemNamespace } from "./memoria-estructurada.logic";

export { MEM_NS, estaVigente, claveDecision, decisionBloqueante, vencimientoEnDias } from "./memoria-estructurada.logic";
export type { DecisionValue, MemNamespace } from "./memoria-estructurada.logic";

function tagEntidad(entityType?: string | null, entityId?: string | null): string {
  return `ent:${entityType ?? "-"}:${entityId ?? "-"}`;
}

// ─── Decisiones ───────────────────────────────────────────────────────────────
export interface RecordarDecisionInput {
  actor: string;
  motivo?: string | null;
  contexto?: Record<string, any>;
  accion?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  vigenciaDias?: number | null;    // null/omitido = permanente
  kind?: "rechazo" | "preferencia"; // default 'rechazo' (bloquea)
}

// Registra (upsert) una decisión del usuario, trazable: quién, cuándo, motivo,
// contexto y vigencia. La clave es entidad+acción → la última decisión gana.
export async function recordarDecision(input: RecordarDecisionInput): Promise<void> {
  const value: DecisionValue = {
    actor: input.actor,
    cuando: new Date().toISOString(),
    motivo: input.motivo ?? null,
    contexto: input.contexto ?? {},
    accion: input.accion ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    vigente_hasta: vencimientoEnDias(input.vigenciaDias),
  };
  await remember({
    namespace: MEM_NS.DECISION,
    kind: input.kind ?? "rechazo",
    key: claveDecision(input.entityType, input.entityId, input.accion),
    value,
    tags: [tagEntidad(input.entityType, input.entityId), input.accion ? `accion:${input.accion}` : "accion:-"],
    source: input.actor,
    confidence: 0.9,
  }).catch(() => {});
}

// Decisiones registradas para una entidad (para consultar antes de recomendar).
export async function decisionesDeEntidad(entityType: string, entityId: string) {
  const rows = await recall({ namespace: MEM_NS.DECISION, tags: [tagEntidad(entityType, entityId)], limit: 20 }).catch(() => []);
  return rows.map(r => ({ kind: r.kind, value: r.value as DecisionValue }));
}

// ¿Hay una decisión VIGENTE del usuario que bloquee `accion` sobre la entidad?
// Devuelve la decisión bloqueante o null. Los agentes lo consultan antes de
// proponer una acción (para no re-proponer lo que el usuario ya rechazó).
export async function decisionQueBloquea(
  entityType: string, entityId: string, accion: string
): Promise<DecisionValue | null> {
  const decisiones = await decisionesDeEntidad(entityType, entityId);
  return decisionBloqueante(decisiones, accion);
}

// ─── Perfiles estructurados (cliente / producto / proveedor / empresa) ───────
// Upsert simple por clave, reutilizando memory_entries. `value` es libre pero
// se recomienda un shape consistente por espacio.
async function upsertPerfil(ns: MemNamespace, key: string, value: any, source = "sistema") {
  await remember({ namespace: ns, key: `${ns}:${key}`, value, source, confidence: 0.7, tags: [`id:${key}`] }).catch(() => {});
}
async function leerPerfil(ns: MemNamespace, key: string) {
  const rows = await recall({ namespace: ns, key: `${ns}:${key}`, limit: 1 }).catch(() => []);
  return rows[0]?.value ?? null;
}

export const recordarCliente = (id: string, datos: any, source?: string) => upsertPerfil(MEM_NS.CLIENTE, id, datos, source);
export const perfilCliente = (id: string) => leerPerfil(MEM_NS.CLIENTE, id);
export const recordarProducto = (id: string, datos: any, source?: string) => upsertPerfil(MEM_NS.PRODUCTO, id, datos, source);
export const perfilProducto = (id: string) => leerPerfil(MEM_NS.PRODUCTO, id);
export const recordarProveedor = (id: string, datos: any, source?: string) => upsertPerfil(MEM_NS.PROVEEDOR, id, datos, source);
export const perfilProveedor = (id: string) => leerPerfil(MEM_NS.PROVEEDOR, id);

// Reglas permanentes de empresa (ej. "no vender debajo del 25% de margen").
export async function recordarReglaEmpresa(clave: string, value: any, source = "usuario") {
  await remember({ namespace: MEM_NS.EMPRESA, key: `empresa:${clave}`, value, source, confidence: 0.95, tags: ["regla"] }).catch(() => {});
}
export async function reglasEmpresa() {
  return recall({ namespace: MEM_NS.EMPRESA, tags: ["regla"], limit: 50 }).catch(() => []);
}
