import type { AIProvider, AICompleteInput, AICompleteResult, ProviderConfig } from "../types";
import { estimarCosto } from "../cost";

// Sirve para OpenAI y CUALQUIER API compatible con el formato de OpenAI:
// OpenRouter, Ollama, LM Studio, o un endpoint propio — solo cambia baseUrl.
export class OpenAICompatibleProvider implements AIProvider {
  constructor(public readonly nombre: string, private cfg: ProviderConfig, private soportaJsonMode = false) {}

  async complete(input: AICompleteInput): Promise<AICompleteResult> {
    const model = input.model ?? (input.fast && this.cfg.modelRapido ? this.cfg.modelRapido : this.cfg.model);
    const base = (this.cfg.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");

    const messages = [
      ...(input.system ? [{ role: "system", content: input.system }] : []),
      ...input.messages.map(m => ({ role: m.role, content: m.content })),
    ];

    const body: Record<string, any> = {
      model,
      messages,
      temperature: input.temperature ?? this.cfg.temperature,
      max_tokens: input.maxTokens ?? this.cfg.maxTokens,
    };
    if (input.json && this.soportaJsonMode) body.response_format = { type: "json_object" };

    const t0 = Date.now();
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.cfg.apiKey ? { Authorization: `Bearer ${this.cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.cfg.timeout),
    });
    const ms = Date.now() - t0;

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`Proveedor respondió ${res.status}: ${detalle.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const inputTokens = data.usage?.prompt_tokens;
    const outputTokens = data.usage?.completion_tokens;

    return {
      text: String(text),
      provider: this.nombre,
      model,
      usage: { inputTokens, outputTokens },
      costUsd: estimarCosto(model, inputTokens, outputTokens),
      ms,
    };
  }
}
