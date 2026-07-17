export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { tieneRol } from "@/lib/admin-auth";
import { pedidosParaArmar } from "@/lib/services/deposito.service";

export async function GET(req: NextRequest) {
  if (!(await tieneRol("admin", "deposito"))) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const f = req.nextUrl.searchParams.get("filtro");
  const filtro = f === "despachados" || f === "todos" ? f : "activos";
  try {
    return NextResponse.json(await pedidosParaArmar(filtro));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
