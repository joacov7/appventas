// ─── Presupuesto de IA: lógica pura (sin DB) ─────────────────────────────────
// Umbrales de alerta y atribución de gasto por agente. Se separa para testear
// sin tocar la base.

export type NivelAlerta = "ok" | "informativa" | "advertencia" | "bloqueo";

export interface EstadoPresupuesto {
  gastado: number;
  limite: number;   // 0 = sin límite
  pct: number;      // 0..∞ (0 si no hay límite)
  nivel: NivelAlerta;
}

// 50% → informativa · 80% → advertencia · 100% → bloqueo. Sin límite → ok.
export function nivelAlerta(gastado: number, limite: number): EstadoPresupuesto {
  if (!limite || limite <= 0) return { gastado, limite: 0, pct: 0, nivel: "ok" };
  const pct = (gastado / limite) * 100;
  const nivel: NivelAlerta = pct >= 100 ? "bloqueo" : pct >= 80 ? "advertencia" : pct >= 50 ? "informativa" : "ok";
  return { gastado, limite, pct, nivel };
}

// Feature con la que se registra el gasto de un agente (atribución).
export function featureDeAgente(agentId: string): string {
  return `agente:${agentId}`;
}

// Deriva la feature de una llamada: la explícita gana; si viene agentId, se
// atribuye al agente; si no, "otros".
export function resolverFeature(input: { feature?: string; agentId?: string }): string {
  if (input.feature) return input.feature;
  if (input.agentId) return featureDeAgente(input.agentId);
  return "otros";
}
