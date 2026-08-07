export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadAclaraciones, saveAclaraciones } from "@/lib/services/aclaraciones.service";

// Público: cualquiera de las vistas (catálogo, portal, checkout) las lee.
export async function GET() {
  return NextResponse.json({ items: await loadAclaraciones() });
}

// Solo admin puede editarlas.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { items } = await req.json();
  await saveAclaraciones(items ?? []);
  return NextResponse.json({ ok: true, items: await loadAclaraciones() });
}
