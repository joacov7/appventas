import { createHash } from "crypto";
import { aiComplete, type AICompleteInput } from "@/lib/ai";
import { recall, remember, reinforce } from "./engine";

function hashInput(input: AICompleteInput): string {
  const base = JSON.stringify({
    system: input.system, messages: input.messages,
    model: input.model, fast: input.fast, json: input.json,
  });
  return "ai:" + createHash("sha256").update(base).digest("hex").slice(0, 32);
}

// Igual que aiComplete, pero cachea el resultado en memoria (namespace "ia").
// Si la misma entrada ya fue resuelta, devuelve el texto guardado SIN llamar
// a la IA — ahorro directo de tokens. Usar solo cuando la misma entrada debe
// producir la misma salida (no para prompts con datos que cambian a diario).
export async function aiCompleteCached(input: AICompleteInput, opts: { ttlHours?: number } = {}): Promise<{ text: string; cached: boolean }> {
  const key = hashInput(input);
  const previos = await recall({ namespace: "ia", key, limit: 1 });
  const hit = previos[0];

  if (hit) {
    const edadHoras = (Date.now() - new Date(hit.updated_at).getTime()) / 3_600_000;
    if (opts.ttlHours == null || edadHoras <= opts.ttlHours) {
      reinforce(hit.id).catch(() => {});
      return { text: String(hit.value?.text ?? ""), cached: true };
    }
  }

  const text = await aiComplete(input);
  await remember({
    namespace: "ia", kind: "cache", key, value: { text },
    source: "ai-cache", confidence: 0.6,
  }).catch(() => {});
  return { text, cached: false };
}
