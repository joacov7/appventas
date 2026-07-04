// ─── Business Memory Engine: contratos ───────────────────────────────────────
// La memoria es el activo central: cualquier agente la consulta y la alimenta.

// Espacios de memoria (namespaces) — el conocimiento de la empresa por área.
export type Namespace =
  | "productos"     // títulos ganadores, fotos que convierten, precios usados, márgenes
  | "clientes"      // historial, preferencias, objeciones, ticket, canal
  | "comercial"     // mensajes/campañas/promos/descuentos exitosos
  | "mercadolibre"  // títulos, categorías, preguntas frecuentes, conversiones
  | "ia"            // caché de respuestas de IA (ahorro de tokens)
  | "reglas"        // reglas del negocio
  | "aprendizajes"  // patrones aprendidos
  | "decisiones";   // qué aceptó/rechazó el usuario

export interface MemoryEntry {
  id: number;
  tenant_id: string;
  namespace: Namespace | string;
  kind: string | null;
  key: string;
  value: any;
  tags: string[];
  source: string | null;
  confidence: number;
  hits: number;
  created_at: string;
  updated_at: string;
}

export interface RememberInput {
  namespace: Namespace | string;
  key: string;
  value: any;
  kind?: string;
  tags?: string[];
  source?: string;
  confidence?: number;
  tenantId?: string;
}

export interface RecallInput {
  namespace: Namespace | string;
  key?: string;
  kind?: string;
  tags?: string[];
  query?: string;      // texto libre sobre el value
  limit?: number;
  tenantId?: string;
}
