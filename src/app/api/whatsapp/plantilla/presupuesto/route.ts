export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { presupuestoAbordaje, setLimiteAbordajeUsd } from "@/lib/whatsapp-plantilla";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json(await presupuestoAbordaje());
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { limite_usd } = await req.json();
  const v = Number(limite_usd);
  if (!Number.isFinite(v) || v < 0 || v > 5000) {
    return NextResponse.json({ error: "Límite inválido (0 a 5000 USD)" }, { status: 400 });
  }
  await setLimiteAbordajeUsd(v);
  return NextResponse.json({ ok: true, ...(await presupuestoAbordaje()) });
}
