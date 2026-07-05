export const dynamic = "force-dynamic";
export const maxDuration = 60; // scraping puede tardar; tope del plan Hobby

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { researchGanadores } from "@/lib/services/research-ml.service";

// Busca "productos ganadores" en MercadoLibre por término.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Falta el término de búsqueda" }, { status: 400 });
  try {
    const res = await researchGanadores(q);
    if (res.total === 0) {
      return NextResponse.json({ error: `Sin resultados para "${q}". Probá con un término más común.` }, { status: 422 });
    }
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error en la búsqueda" }, { status: 500 });
  }
}
