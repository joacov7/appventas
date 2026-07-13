export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { presupuestoPlaces, setLimitePlacesUsd } from "@/lib/services/places.service";

// Estado del gasto mensual de Google Places (uso, gasto estimado y límite).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json(await presupuestoPlaces());
}

// Cambia el límite mensual (en USD).
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { limite_usd } = await req.json();
  const v = Number(limite_usd);
  if (!Number.isFinite(v) || v < 0 || v > 1000) {
    return NextResponse.json({ error: "Límite inválido (0 a 1000 USD)" }, { status: 400 });
  }
  await setLimitePlacesUsd(v);
  return NextResponse.json({ ok: true, ...(await presupuestoPlaces()) });
}
