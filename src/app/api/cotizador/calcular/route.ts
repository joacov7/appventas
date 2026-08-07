export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { calcularPresupuesto, type EntradaPresupuesto } from "@/lib/services/cotizador.service";

// Calcula un presupuesto de forma determinística (sin IA).
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = (await req.json()) as EntradaPresupuesto;
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Agregá al menos un producto" }, { status: 400 });
  }
  try {
    const presupuesto = await calcularPresupuesto({
      items: body.items,
      canal: body.canal === "mayorista" ? "mayorista" : "minorista",
      medioPago: body.medioPago || "efectivo",
      descuentoGlobalPct: Number(body.descuentoGlobalPct) || 0,
    });
    return NextResponse.json(presupuesto);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
