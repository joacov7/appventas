// ─── Punto de entrada único de IA ────────────────────────────────────────────
// Todos los módulos usan getAI().complete(...). Nunca instancian un SDK directo.

import type { AIProvider, AICompleteInput, AICompleteResult, AIConfig } from "./types";
import { loadConfig } from "./config";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";

export * from "./types";
export { loadConfig, saveConfig, toMasked, applyEdits, defaultConfig } from "./config";
export {
  AIBudgetExceededError, loadPresupuestoIA, savePresupuestoIA, resumenGastoIA,
  gastoDelMesAgente, resumenPresupuestoAgentes, nivelAlerta, resolverFeature,
} from "./gasto";
export type { EstadoPresupuesto, NivelAlerta } from "./gasto";

import { registrarGastoIA, verificarPresupuestoIA, verificarPresupuestoAgente } from "./gasto";
import { resolverFeature } from "./presupuesto.logic";

export class AINotConfiguredError extends Error {}

function construir(nombre: string, cfg: AIConfig): AIProvider {
  const pc = cfg.proveedores[nombre];
  if (!pc) throw new AINotConfiguredError(`Proveedor de IA "${nombre}" no existe en la configuración`);
  if (!pc.enabled) throw new AINotConfiguredError(`El proveedor "${nombre}" está desactivado`);
  if (!pc.apiKey && nombre !== "custom") throw new AINotConfiguredError(`Falta la API key de "${nombre}"`);

  switch (nombre) {
    case "anthropic":
      return new AnthropicProvider(pc);
    case "openai":
      return new OpenAICompatibleProvider("openai", pc, /* jsonMode */ true);
    default:
      // custom u otro compatible-OpenAI por URL (OpenRouter, Ollama, LM Studio...)
      if (!pc.baseUrl) throw new AINotConfiguredError(`El proveedor "${nombre}" necesita una URL base`);
      return new OpenAICompatibleProvider(nombre, pc, false);
  }
}

export interface AIClient {
  complete(input: AICompleteInput): Promise<AICompleteResult>;
  readonly provider: string;
}

// Resuelve el proveedor activo desde la config (editable en el admin) y
// devuelve un cliente listo para usar. Cambiar de proveedor = cambiar config,
// sin tocar código.
export async function getAI(providerOverride?: string): Promise<AIClient> {
  const cfg = await loadConfig();
  const nombre = providerOverride ?? cfg.activo;
  const provider = construir(nombre, cfg);

  return {
    provider: nombre,
    async complete(input: AICompleteInput): Promise<AICompleteResult> {
      // Tope mensual GLOBAL: corta antes de gastar si está superado.
      await verificarPresupuestoIA();
      // Tope POR AGENTE (si la llamada viene de un agente con presupuesto propio).
      if (input.agentId) await verificarPresupuestoAgente(input.agentId);
      if (cfg.debug) {
        console.log(`[AI:${nombre}] →`, JSON.stringify({ system: input.system?.slice(0, 120), msgs: input.messages.length }));
      }
      const result = await provider.complete(input);
      // Registra el gasto atribuido (feature explícita > agente:<id> > "otros").
      await registrarGastoIA(resolverFeature(input), result);
      if (cfg.debug) {
        console.log(`[AI:${nombre}] ← ${result.model} · ${result.ms}ms · ~$${result.costUsd?.toFixed(4) ?? "?"} · ${result.usage?.outputTokens ?? "?"} tok`);
      }
      return result;
    },
  };
}

// Helper para las funciones que esperan solo el texto (migración simple)
export async function aiComplete(input: AICompleteInput): Promise<string> {
  const ai = await getAI();
  const { text } = await ai.complete(input);
  return text;
}
