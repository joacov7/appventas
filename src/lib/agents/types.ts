// ─── Agent Engine: contratos ─────────────────────────────────────────────────

export type AutonomyMode = "manual" | "assisted" | "autonomous";

export interface AgentDecision {
  resumen: string;
  recomendaciones?: { titulo: string; detalle: string }[];
  data?: any;
}

// Telemetría capturada durante una ejecución (para el Centro de Agentes).
export interface AgentTelemetry {
  toolsUsados: string[];
  memoriaConsultas: number;
  memoriaEscrituras: number;
  llamadasIA: number;
  model: string | null;
  costUsd: number;
  logs: string[];
  accionesPropuestas: { tool: string; input: any }[];
}

export interface AgentRunResult {
  agentId: string;
  ok: boolean;
  autonomy: AutonomyMode;
  decision: AgentDecision | null;
  telemetry: AgentTelemetry;
  ms: number;
  error?: string;
}

// Contexto que recibe el handler del agente. Envuelve memoria, tools e IA
// registrando todo (telemetría) y respetando el modo de autonomía.
export interface AgentRunContext {
  agentId: string;
  autonomy: AutonomyMode;
  recall(input: { namespace: string; query?: string; tags?: string[]; kind?: string; limit?: number }): Promise<any[]>;
  remember(input: { namespace: string; key: string; value: any; kind?: string; tags?: string[]; source?: string; confidence?: number }): Promise<void>;
  /** Ejecuta una tool. Las de escritura se ejecutan solo en modo autónomo; en el resto se proponen (devuelve { propuesta: true }). */
  tool<O = any>(name: string, input?: any): Promise<O>;
  /** Llama a la IA (último recurso). Registra costo y modelo. */
  ai(input: { system?: string; messages: { role: "user" | "assistant" | "system"; content: string }[]; maxTokens?: number; fast?: boolean; json?: boolean }): Promise<string>;
  log(msg: string): void;
}

export interface AgentDef {
  id: string;
  nombre: string;
  rol: string;
  objetivo: string;
  categoria: string;
  /** Tools que el agente tiene permitido usar */
  tools: string[];
  defaultAutonomy: AutonomyMode;
  handler: (ctx: AgentRunContext) => Promise<AgentDecision>;
}

export type Schedule = "off" | "diario" | "semanal";

export interface AgentConfig {
  enabled: boolean;
  autonomy: AutonomyMode;
  schedule?: Schedule; // off = solo manual; semanal = los lunes
}
