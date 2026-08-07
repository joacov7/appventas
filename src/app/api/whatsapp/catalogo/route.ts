export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadBotCatalogo, saveBotCatalogo } from "@/lib/bot-config";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json(await loadBotCatalogo());
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { modo, drive_url } = await req.json();
  await saveBotCatalogo({ modo, drive_url });
  return NextResponse.json({ ok: true, ...(await loadBotCatalogo()) });
}
