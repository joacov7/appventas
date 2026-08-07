// Estimación de costo (USD) por modelo. Aproximado; solo informativo.
// Precios por 1M de tokens (entrada / salida).
const PRECIOS: Record<string, { in: number; out: number }> = {
  // Anthropic
  "claude-opus-4-8":            { in: 15,   out: 75 },
  "claude-sonnet-5":            { in: 3,    out: 15 },
  "claude-haiku-4-5-20251001":  { in: 1,    out: 5 },
  // OpenAI (aprox)
  "gpt-4o":                     { in: 2.5,  out: 10 },
  "gpt-4o-mini":                { in: 0.15, out: 0.6 },
  "gpt-4.1":                    { in: 2,    out: 8 },
  "gpt-4.1-mini":               { in: 0.4,  out: 1.6 },
};

export function estimarCosto(model: string, inputTokens?: number, outputTokens?: number): number | null {
  const p = PRECIOS[model];
  if (!p || inputTokens == null || outputTokens == null) return null;
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}
