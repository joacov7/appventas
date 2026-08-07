export const dynamic = "force-dynamic";
export const maxDuration = 45;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { jefeDeGabinete } from "@/lib/agents/jefe";
import { registry } from "@/lib/tools";

// Chat con el Jefe de Gabinete desde el admin.
// - mensaje normal → interpreta y responde (o propone una acción para confirmar).
// - confirmar: true + accion → ejecuta la acción propuesta.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { mensaje, confirmar, accion } = await req.json();

  try {
    // Confirmación de una acción propuesta (el usuario dijo SÍ).
    if (confirmar && accion?.tool) {
      const res = await registry.execute(accion.tool, accion.input ?? {});
      if (!res.ok) return NextResponse.json({ tipo: "texto", texto: `No pude hacerlo: ${res.error}` });
      return NextResponse.json({ tipo: "texto", texto: `✅ Hecho. ${accion.resumen ? "" : ""}`.trim() || "✅ Hecho." });
    }

    if (!mensaje?.trim()) return NextResponse.json({ tipo: "texto", texto: "Decime qué necesitás." });
    const r = await jefeDeGabinete(String(mensaje));
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ tipo: "texto", texto: `Hubo un error: ${e?.message ?? "desconocido"}` }, { status: 200 });
  }
}
