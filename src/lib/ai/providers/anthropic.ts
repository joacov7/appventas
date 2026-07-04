import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AICompleteInput, AICompleteResult, ProviderConfig } from "../types";
import { estimarCosto } from "../cost";

export class AnthropicProvider implements AIProvider {
  readonly nombre = "anthropic";
  constructor(private cfg: ProviderConfig) {}

  async complete(input: AICompleteInput): Promise<AICompleteResult> {
    const model = input.model ?? (input.fast && this.cfg.modelRapido ? this.cfg.modelRapido : this.cfg.model);
    const client = new Anthropic({
      apiKey: this.cfg.apiKey,
      ...(this.cfg.baseUrl ? { baseURL: this.cfg.baseUrl } : {}),
    });

    const t0 = Date.now();
    const msg = await client.messages.create(
      {
        model,
        max_tokens: input.maxTokens ?? this.cfg.maxTokens,
        temperature: input.temperature ?? this.cfg.temperature,
        ...(input.system ? { system: input.system } : {}),
        messages: input.messages
          .filter(m => m.role !== "system")
          .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      },
      { timeout: this.cfg.timeout }
    );
    const ms = Date.now() - t0;

    const text = msg.content.find(c => c.type === "text");
    return {
      text: text && text.type === "text" ? text.text : "",
      provider: this.nombre,
      model,
      usage: { inputTokens: msg.usage?.input_tokens, outputTokens: msg.usage?.output_tokens },
      costUsd: estimarCosto(model, msg.usage?.input_tokens, msg.usage?.output_tokens),
      ms,
    };
  }
}
