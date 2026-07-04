// ─── Tool Registry: contratos ────────────────────────────────────────────────
// Una Tool es una capacidad reutilizable que cualquier agente puede usar sin
// conocer su implementación. Separa Agentes de la lógica concreta.

import type { ZodType } from "zod";

export type SideEffect = "read" | "write";

export interface ToolContext {
  tenantId?: string;
  agentId?: string;
  /** Nivel de autonomía del agente que la invoca (para futuras validaciones) */
  autonomy?: "manual" | "assisted" | "autonomous";
}

// Metadato de un parámetro (para mostrar en el Centro de Agentes / documentar)
export interface ToolParam {
  nombre: string;
  tipo: "string" | "number" | "boolean" | "array" | "object";
  requerido: boolean;
  descripcion: string;
}

export interface Tool<I = any, O = any> {
  /** Identificador único, snake_case (ej: buscar_productos) */
  name: string;
  description: string;
  category: string;
  /** read = solo consulta; write = produce efectos (crea/envía/publica) */
  sideEffect: SideEffect;
  /** Validación de entrada */
  input: ZodType<I>;
  /** Parámetros documentados para la UI y los agentes */
  params: ToolParam[];
  run: (input: I, ctx?: ToolContext) => Promise<O>;
}

export interface ToolResult<O = any> {
  ok: boolean;
  tool: string;
  ms: number;
  output?: O;
  error?: string;
}

// Descripción liviana (sin el handler) para listar/mostrar
export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  sideEffect: SideEffect;
  params: ToolParam[];
}
