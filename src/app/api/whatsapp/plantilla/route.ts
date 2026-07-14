export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadPlantillaConfig, savePlantillaConfig } from "@/lib/whatsapp-plantilla";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json(await loadPlantillaConfig());
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { nombre, idioma } = await req.json();
  await savePlantillaConfig({ nombre: String(nombre ?? "").trim(), idioma: String(idioma ?? "es_AR").trim() });
  return NextResponse.json({ ok: true, ...(await loadPlantillaConfig()) });
}
