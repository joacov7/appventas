export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadBotTextos, saveBotTextos, BOT_DEFAULTS } from "@/lib/bot-config";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json({ textos: await loadBotTextos(), defaults: BOT_DEFAULTS });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = await req.json();
  // Solo aceptamos las claves conocidas.
  const permitidas = Object.keys(BOT_DEFAULTS);
  const limpio: Record<string, string> = {};
  for (const k of permitidas) if (typeof body[k] === "string") limpio[k] = body[k];
  await saveBotTextos(limpio as any);
  return NextResponse.json({ ok: true, textos: await loadBotTextos() });
}
