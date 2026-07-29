export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadBotIA, saveBotIA } from "@/lib/bot-config";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json(await loadBotIA());
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { activo, instrucciones } = await req.json();
  await saveBotIA({ activo: !!activo, instrucciones: instrucciones ?? "" });
  return NextResponse.json({ ok: true, ...(await loadBotIA()) });
}
