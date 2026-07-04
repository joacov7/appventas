export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { registry } from "@/lib/tools";

// Lista las herramientas disponibles, agrupadas por categoría.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json({
    total: registry.list().length,
    categorias: registry.byCategory(),
  });
}
