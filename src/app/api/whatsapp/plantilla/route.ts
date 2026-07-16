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
  const body = await req.json();
  // Nuevo formato: { plantillas: { mayorista: {nombre, idioma}, ... } }
  // Compat: { nombre, idioma } (plantilla única de mayoristas).
  if (body.plantillas && typeof body.plantillas === "object") {
    const limpio: Record<string, { nombre: string; idioma: string }> = {};
    for (const [k, v] of Object.entries(body.plantillas as Record<string, any>)) {
      limpio[k] = { nombre: String(v?.nombre ?? "").trim(), idioma: String(v?.idioma ?? "es_AR").trim() };
    }
    await savePlantillaConfig({ plantillas: limpio });
  } else {
    await savePlantillaConfig({ nombre: String(body.nombre ?? "").trim(), idioma: String(body.idioma ?? "es_AR").trim() });
  }
  return NextResponse.json({ ok: true, ...(await loadPlantillaConfig()) });
}
