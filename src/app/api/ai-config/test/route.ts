export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getAI } from "@/lib/ai";

// Prueba de conexión: manda un ping al proveedor indicado (o al activo)
// y reporta si respondió, con latencia y costo estimado.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { proveedor } = await req.json().catch(() => ({}));

  try {
    const ai = await getAI(proveedor);
    const r = await ai.complete({
      system: "Respondé solo con la palabra: OK",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 10,
      temperature: 0,
    });
    return NextResponse.json({
      ok: true,
      provider: r.provider,
      model: r.model,
      ms: r.ms,
      costUsd: r.costUsd,
      respuesta: r.text.trim().slice(0, 60),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error de conexión" }, { status: 200 });
  }
}
