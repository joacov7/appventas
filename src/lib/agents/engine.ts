import { prisma } from "@/lib/prisma";
import { registry } from "@/lib/tools";
import { getAI } from "@/lib/ai";
import { recall as memRecall, remember as memRemember } from "@/lib/memory";
import type { AgentDef, AgentRunContext, AgentRunResult, AgentTelemetry, AutonomyMode } from "./types";

async function ensureTables() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id BIGSERIAL PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      agent_id TEXT NOT NULL,
      ok BOOLEAN,
      decision JSONB,
      telemetry JSONB,
      cost_usd REAL,
      ms INT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {});
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS action_queue (
      id BIGSERIAL PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      agent_id TEXT,
      tool TEXT,
      input JSONB,
      estado TEXT DEFAULT 'pendiente',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {});
}

// Ejecuta un agente aplicando el flujo memoria→reglas→datos→IA→experiencia,
// registrando toda la telemetría y respetando el modo de autonomía.
export async function runAgent(def: AgentDef, autonomy: AutonomyMode): Promise<AgentRunResult> {
  await ensureTables();
  const t0 = Date.now();
  const tel: AgentTelemetry = {
    toolsUsados: [], memoriaConsultas: 0, memoriaEscrituras: 0,
    llamadasIA: 0, model: null, costUsd: 0, logs: [], accionesPropuestas: [],
  };

  const ctx: AgentRunContext = {
    agentId: def.id,
    autonomy,
    async recall(input) {
      tel.memoriaConsultas++;
      return memRecall(input as any);
    },
    async remember(input) {
      tel.memoriaEscrituras++;
      await memRemember(input as any);
    },
    async tool(name, input) {
      if (!def.tools.includes(name)) {
        tel.logs.push(`⚠️ tool "${name}" no permitida para ${def.id}`);
        throw new Error(`El agente no tiene permiso para usar "${name}"`);
      }
      const toolDef = registry.get(name);
      // Escritura: solo se ejecuta en modo autónomo; si no, se PROPONE.
      if (toolDef?.sideEffect === "write" && autonomy !== "autonomous") {
        tel.accionesPropuestas.push({ tool: name, input });
        try {
          await (prisma as any).$executeRawUnsafe(
            `INSERT INTO action_queue (agent_id, tool, input, estado) VALUES ($1,$2,$3::jsonb,'pendiente')`,
            def.id, name, JSON.stringify(input ?? {})
          );
          tel.logs.push(`📝 ${name} encolado en Aprobaciones (modo ${autonomy})`);
        } catch (e: any) {
          tel.logs.push(`✗ no se pudo encolar ${name}: ${e?.message ?? "error"}`);
        }
        return { propuesta: true } as any;
      }
      const res = await registry.execute(name, input);
      tel.toolsUsados.push(name);
      if (!res.ok) tel.logs.push(`✗ ${name}: ${res.error}`);
      return res.output;
    },
    async ai(input) {
      tel.llamadasIA++;
      const client = await getAI();
      const r = await client.complete(input as any);
      tel.model = r.model;
      tel.costUsd += r.costUsd ?? 0;
      tel.logs.push(`🤖 IA ${r.model} · ${r.ms}ms · ~$${(r.costUsd ?? 0).toFixed(5)}`);
      return r.text;
    },
    log(msg) { tel.logs.push(msg); },
  };

  let ok = true, error: string | undefined, decision = null as any;
  try {
    decision = await def.handler(ctx);
  } catch (e: any) {
    ok = false;
    error = e?.message ?? "Error en el agente";
    tel.logs.push(`✗ ${error}`);
  }

  const ms = Date.now() - t0;
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO agent_runs (agent_id, ok, decision, telemetry, cost_usd, ms)
     VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6)`,
    def.id, ok, JSON.stringify(decision), JSON.stringify(tel), tel.costUsd, ms
  ).catch(() => {});

  return { agentId: def.id, ok, autonomy, decision, telemetry: tel, ms, error };
}

export async function lastRuns(agentId?: string, limit = 10): Promise<any[]> {
  await ensureTables();
  try {
    if (agentId) {
      return await (prisma as any).$queryRawUnsafe(
        `SELECT * FROM agent_runs WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2`, agentId, limit);
    }
    return await (prisma as any).$queryRawUnsafe(
      `SELECT DISTINCT ON (agent_id) * FROM agent_runs ORDER BY agent_id, created_at DESC`);
  } catch {
    return [];
  }
}
