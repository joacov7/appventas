export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { avisarPendientes } from "@/lib/services/whatsapp-pendientes.service";

// Recordatorio (barrido de respaldo): conversaciones sin responder → aviso Telegram.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pendientes = await avisarPendientes();
  return NextResponse.json({ ok: true, pendientes });
}
