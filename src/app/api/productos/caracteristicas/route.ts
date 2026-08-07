export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Mapa {product_id: string[]} con las características de todos los productos.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({}, { status: 401 });
  try {
    await ensureSchema("premium");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT product_id, items FROM producto_caracteristicas`);
    const map: Record<string, string[]> = {};
    for (const r of rows) map[r.product_id] = Array.isArray(r.items) ? r.items.map((x: any) => String(x)) : [];
    return NextResponse.json(map);
  } catch {
    return NextResponse.json({});
  }
}
