export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { productosParaCotizar } from "@/lib/services/cotizador.service";

// Lista productos cotizables (precio, costo, fabricante) para el armado.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  try {
    const productos = await productosParaCotizar(q);
    return NextResponse.json(productos);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
