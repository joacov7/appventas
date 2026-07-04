export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { saveAgentConfig } from "@/lib/agents";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { agentId, enabled, autonomy } = await req.json();
  if (!agentId) return NextResponse.json({ error: "agentId requerido" }, { status: 400 });
  if (autonomy && !["manual", "assisted", "autonomous"].includes(autonomy)) {
    return NextResponse.json({ error: "autonomy inválido" }, { status: 400 });
  }
  await saveAgentConfig(agentId, { enabled: enabled !== false, autonomy: autonomy ?? "manual" });
  return NextResponse.json({ ok: true });
}
