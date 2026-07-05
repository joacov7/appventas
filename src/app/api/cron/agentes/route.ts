export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { AGENTS, loadAgentConfigs, runAgent } from "@/lib/agents";

// Cron diario: ejecuta los agentes según su frecuencia configurada.
// "diario" corre todos los días; "semanal" corre los lunes.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const configs = await loadAgentConfigs();
  const esLunes = new Date().getDay() === 1;
  const ejecutados: { agente: string; ok: boolean; ms: number }[] = [];

  for (const def of AGENTS) {
    const cfg = configs[def.id];
    if (!cfg?.enabled) continue;
    const toca = cfg.schedule === "diario" || (cfg.schedule === "semanal" && esLunes);
    if (!toca) continue;
    try {
      const r = await runAgent(def, cfg.autonomy);
      ejecutados.push({ agente: def.id, ok: r.ok, ms: r.ms });
    } catch (e: any) {
      ejecutados.push({ agente: def.id, ok: false, ms: 0 });
    }
  }

  return NextResponse.json({ ok: true, fecha: new Date().toISOString(), ejecutados });
}
