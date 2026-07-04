import type { Tool, ToolContext, ToolResult, ToolInfo } from "./types";

// Registro central de herramientas. Singleton en memoria del server.
class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    if (this.tools.has(tool.name)) return; // idempotente (hot-reload)
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  info(): ToolInfo[] {
    return this.list().map(({ name, description, category, sideEffect, params }) => ({
      name, description, category, sideEffect, params,
    }));
  }

  byCategory(): Record<string, ToolInfo[]> {
    const out: Record<string, ToolInfo[]> = {};
    for (const t of this.info()) (out[t.category] ??= []).push(t);
    return out;
  }

  // Ejecuta una tool validando la entrada. Devuelve un resultado uniforme.
  async execute(name: string, rawInput: unknown, ctx?: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, tool: name, ms: 0, error: `Tool "${name}" no existe` };

    const t0 = Date.now();
    try {
      const parsed = tool.input.parse(rawInput ?? {});
      const output = await tool.run(parsed, ctx);
      return { ok: true, tool: name, ms: Date.now() - t0, output };
    } catch (e: any) {
      return { ok: false, tool: name, ms: Date.now() - t0, error: e?.message ?? "Error ejecutando la tool" };
    }
  }
}

export const registry = new ToolRegistry();
