export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getAgent, runAgent, loadAgentConfigs } from "@/lib/agents";

// Ejecuta un agente a demanda.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { agentId } = await req.json();
  const def = getAgent(agentId);
  if (!def) return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });

  const configs = await loadAgentConfigs();
  const cfg = configs[agentId] ?? { enabled: true, autonomy: def.defaultAutonomy };
  if (!cfg.enabled) return NextResponse.json({ error: "El agente está desactivado" }, { status: 400 });

  const result = await runAgent(def, cfg.autonomy);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
