export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { aplicarPrecioSugerido } from "@/lib/services/pricing.service";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { productId, precio } = await req.json();
  const res = await aplicarPrecioSugerido(String(productId), Number(precio), "sugerencia-competencia");
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
