export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { enriquecerLote } from "@/lib/services/enriquecimiento.service";

// Enriquece un lote de prospectos (email/redes desde su sitio web).
// El cliente lo llama en loop hasta que restantes = 0.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { limit } = await req.json().catch(() => ({}));
    const r = await enriquecerLote(Number(limit) || 10);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error enriqueciendo" }, { status: 500 });
  }
}
