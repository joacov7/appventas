export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { AGENTS, loadAgentConfigs, lastRuns } from "@/lib/agents";

// Lista los agentes con su config y su última ejecución.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const [configs, runs] = await Promise.all([loadAgentConfigs(), lastRuns()]);
  const runByAgent = new Map(runs.map((r: any) => [r.agent_id, r]));

  const agentes = AGENTS.map(a => {
    const cfg = configs[a.id] ?? { enabled: true, autonomy: a.defaultAutonomy };
    const run = runByAgent.get(a.id);
    return {
      id: a.id, nombre: a.nombre, rol: a.rol, objetivo: a.objetivo, categoria: a.categoria,
      tools: a.tools,
      enabled: cfg.enabled, autonomy: cfg.autonomy,
      ultimaEjecucion: run ? {
        fecha: run.created_at, ok: run.ok, ms: run.ms, costUsd: run.cost_usd,
        decision: run.decision, telemetry: run.telemetry,
      } : null,
    };
  });
  return NextResponse.json({ agentes });
}
