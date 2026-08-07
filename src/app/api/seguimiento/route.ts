export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { seguimientosPendientes, marcarSeguido } from "@/lib/services/seguimiento.service";

// Lista lo que necesita seguimiento (prospectos + presupuestos).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    return NextResponse.json(await seguimientosPendientes());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// Marca un prospecto como "ya seguido" para que no vuelva a aparecer enseguida.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { prospectoId } = await req.json();
  if (!prospectoId) return NextResponse.json({ error: "prospectoId requerido" }, { status: 400 });
  try {
    await marcarSeguido(Number(prospectoId));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
