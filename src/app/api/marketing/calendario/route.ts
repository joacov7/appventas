export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { proximasFechas } from "@/lib/services/calendario.service";

// Próximas fechas comerciales dentro de una ventana de anticipación.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const ventana = Number(new URL(req.url).searchParams.get("ventana")) || 120;
  try {
    return NextResponse.json(proximasFechas(ventana));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
