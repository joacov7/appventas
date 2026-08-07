export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadWhatsAppMasked, saveWhatsAppConfig, applyWhatsAppEdits } from "@/lib/whatsapp-config";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json(await loadWhatsAppMasked());
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const edits = await req.json();
  const nueva = await applyWhatsAppEdits(edits);
  await saveWhatsAppConfig(nueva);
  return NextResponse.json(await loadWhatsAppMasked());
}
