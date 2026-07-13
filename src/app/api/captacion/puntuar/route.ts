export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { puntuarTodos } from "@/lib/services/scoring.service";

// Recalcula el puntaje A/B/C de toda la cartera de prospectos.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const r = await puntuarTodos();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error puntuando" }, { status: 500 });
  }
}
