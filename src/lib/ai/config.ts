import { prisma } from "@/lib/prisma";
import type { AIConfig, ProviderConfig } from "./types";

const KEY = "ai_config";

const DEFAULT_PROVIDER = (over: Partial<ProviderConfig> = {}): ProviderConfig => ({
  enabled: false,
  apiKey: "",
  model: "",
  modelRapido: "",
  baseUrl: "",
  temperature: 0.7,
  maxTokens: 1500,
  timeout: 30000,
  ...over,
});

// Config por defecto. Anthropic arranca habilitado y toma la key de entorno
// si existe, así las funciones actuales siguen andando sin configurar nada.
export function defaultConfig(): AIConfig {
  return {
    activo: "anthropic",
    debug: false,
    proveedores: {
      anthropic: DEFAULT_PROVIDER({
        enabled: true,
        apiKey: process.env.ANTHROPIC_API_KEY ?? "",
        model: "claude-sonnet-5",
        modelRapido: "claude-haiku-4-5-20251001",
      }),
      openai: DEFAULT_PROVIDER({
        model: "gpt-4o",
        modelRapido: "gpt-4o-mini",
        baseUrl: "https://api.openai.com/v1",
      }),
      custom: DEFAULT_PROVIDER({
        // Compatible-OpenAI por URL: OpenRouter, Ollama, LM Studio, propio
        baseUrl: "",
      }),
    },
  };
}

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS catalog_config (
      tipo TEXT PRIMARY KEY,
      config JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
}

// Deep-merge de la config guardada sobre los defaults (para que claves nuevas existan)
function merge(base: AIConfig, saved: Partial<AIConfig> | null): AIConfig {
  if (!saved) return base;
  const proveedores: AIConfig["proveedores"] = { ...base.proveedores };
  for (const [k, v] of Object.entries(saved.proveedores ?? {})) {
    proveedores[k] = { ...(base.proveedores[k] ?? DEFAULT_PROVIDER()), ...v };
  }
  // Fallback de key de entorno para anthropic si quedó vacía
  if (proveedores.anthropic && !proveedores.anthropic.apiKey && process.env.ANTHROPIC_API_KEY) {
    proveedores.anthropic.apiKey = process.env.ANTHROPIC_API_KEY;
  }
  return {
    activo: saved.activo ?? base.activo,
    debug: saved.debug ?? base.debug,
    proveedores,
  };
}

// Config real (con las API keys) — uso interno del servidor
export async function loadConfig(): Promise<AIConfig> {
  await ensureTable();
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, KEY
    );
    return merge(defaultConfig(), rows[0]?.config ?? null);
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(cfg: AIConfig): Promise<void> {
  await ensureTable();
  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO catalog_config (tipo, config)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()
  `, KEY, JSON.stringify(cfg));
}

// ─── Enmascarado de API keys para el admin (nunca mandamos la key completa) ──
export function maskKey(k: string): string {
  if (!k) return "";
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 3)}••••${k.slice(-4)}`;
}

// Devuelve la config con las keys enmascaradas + flag hasKey, para el frontend
export function toMasked(cfg: AIConfig) {
  const proveedores: Record<string, any> = {};
  for (const [k, v] of Object.entries(cfg.proveedores)) {
    proveedores[k] = { ...v, apiKey: maskKey(v.apiKey), hasKey: !!v.apiKey };
  }
  return { activo: cfg.activo, debug: cfg.debug, proveedores };
}

// Aplica cambios del admin conservando las keys que no se editaron
// (si llega la versión enmascarada, se mantiene la key guardada)
export function applyEdits(actual: AIConfig, edits: any): AIConfig {
  const proveedores: AIConfig["proveedores"] = { ...actual.proveedores };
  for (const [k, v] of Object.entries<any>(edits.proveedores ?? {})) {
    const prev = proveedores[k] ?? DEFAULT_PROVIDER();
    const keyEditada = typeof v.apiKey === "string" && v.apiKey && v.apiKey !== maskKey(prev.apiKey);
    proveedores[k] = {
      ...prev,
      ...v,
      apiKey: keyEditada ? v.apiKey : prev.apiKey,
    };
    delete (proveedores[k] as any).hasKey;
  }
  return {
    activo: edits.activo ?? actual.activo,
    debug: edits.debug ?? actual.debug,
    proveedores,
  };
}
