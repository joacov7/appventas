// ─── Capa de IA: contratos únicos ────────────────────────────────────────────
// Ningún módulo llama directo a una API de IA. Todos pasan por AIProvider.

export type AIRole = "system" | "user" | "assistant";
export interface AIMessage { role: AIRole; content: string; }

export interface AICompleteInput {
  system?: string;
  messages: AIMessage[];
  /** Sobrescribe el modelo configurado (opcional; normalmente lo decide la config) */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Usa el modelo rápido/barato configurado, si existe */
  fast?: boolean;
  /** Pide salida JSON (best-effort según el proveedor) */
  json?: boolean;
  /** Etiqueta de la función que hace la llamada (para el registro de gasto) */
  feature?: string;
  /** Id del agente que origina la llamada. Atribuye el gasto y activa el
   *  presupuesto por agente (tope mensual propio, además del global). */
  agentId?: string;
}

export interface AICompleteResult {
  text: string;
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  costUsd?: number | null;
  ms: number;
}

// Interfaz que implementa cada proveedor (Anthropic, OpenAI-compatible, ...)
export interface AIProvider {
  readonly nombre: string;
  complete(input: AICompleteInput): Promise<AICompleteResult>;
}

// Config de un proveedor tal como se guarda/edita desde el admin
export interface ProviderConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  modelRapido?: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  timeout: number; // ms
}

export interface AIConfig {
  activo: string;              // clave del proveedor activo
  debug: boolean;
  proveedores: Record<string, ProviderConfig>;
}
