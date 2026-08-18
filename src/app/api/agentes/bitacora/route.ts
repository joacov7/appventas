export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { AGENTS } from "@/lib/agents/definitions";

// Nombre legible del agente a partir de su id.
function nombreAgente(id: string | null): string {
  if (!id) return "Sistema";
  const a = AGENTS.find((x) => x.id === id);
  return a?.nombre ?? id;
}

// Bitácora unificada: junta las ejecuciones de los agentes (agent_runs) y las
// acciones que proponen/aprueban/rechazan (action_queue) en una sola línea de
// tiempo, ordenada de lo más nuevo a lo más viejo.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }
  await ensureSchema("agentes");

  const sp = req.nextUrl.searchParams;
  const agente = sp.get("agente") || undefined; // filtrar por id de agente
  const tipo = sp.get("tipo") || undefined; // "ejecucion" | "accion"
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 300);

  const eventos: any[] = [];

  // ── Ejecuciones ──
  if (tipo !== "accion") {
    try {
      const runs: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT id, agent_id, ok, decision, telemetry, cost_usd, ms, created_at
           FROM agent_runs
          ${agente ? "WHERE agent_id = $1" : ""}
          ORDER BY created_at DESC LIMIT ${limit}`,
        ...(agente ? [agente] : [])
      );
      for (const r of runs) {
        const tel = r.telemetry ?? {};
        eventos.push({
          key: `run-${r.id}`,
          tipo: "ejecucion",
          fecha: r.created_at,
          agentId: r.agent_id,
          agente: nombreAgente(r.agent_id),
          ok: r.ok,
          ms: r.ms,
          costUsd: r.cost_usd ?? 0,
          tools: tel.toolsUsados ?? [],
          logs: tel.logs ?? [],
          resumen: typeof r.decision === "object" && r.decision
            ? (r.decision.resumen ?? r.decision.mensaje ?? null)
            : null,
        });
      }
    } catch { /* tabla puede no existir aún */ }
  }

  // ── Acciones (propuestas / aprobadas / rechazadas) ──
  if (tipo !== "ejecucion") {
    try {
      const acciones: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT id, agent_id, tool, input, estado, resultado, created_at, resuelto_en
           FROM action_queue
          ${agente ? "WHERE agent_id = $1" : ""}
          ORDER BY created_at DESC LIMIT ${limit}`,
        ...(agente ? [agente] : [])
      );
      for (const a of acciones) {
        eventos.push({
          key: `acc-${a.id}`,
          tipo: "accion",
          fecha: a.created_at,
          resueltoEn: a.resuelto_en,
          agentId: a.agent_id,
          agente: nombreAgente(a.agent_id),
          tool: a.tool,
          input: a.input,
          estado: a.estado, // pendiente | ejecutada | rechazada | error
        });
      }
    } catch { /* tabla puede no existir aún */ }
  }

  // Orden unificado por fecha (más nuevo primero) y recorte.
  eventos.sort((x, y) => new Date(y.fecha).getTime() - new Date(x.fecha).getTime());

  return NextResponse.json({
    eventos: eventos.slice(0, limit),
    agentes: AGENTS.map((a) => ({ id: a.id, nombre: a.nombre })),
  });
}
