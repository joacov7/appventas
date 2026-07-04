export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadConfig, saveConfig, toMasked, applyEdits } from "@/lib/ai";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const cfg = await loadConfig();
  return NextResponse.json(toMasked(cfg));
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const edits = await req.json();
  const actual = await loadConfig();
  const nueva = applyEdits(actual, edits);
  await saveConfig(nueva);
  return NextResponse.json(toMasked(nueva));
}
