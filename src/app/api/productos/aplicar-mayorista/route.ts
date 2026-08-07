export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Pone el precio MAYORISTA como precio visible de la tienda (product_variants.price).
// Para el modo mayorista: toda la tienda pasa a mostrar el precio mayorista.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    await ensureSchema("pricing");
    const upd: any = await (prisma as any).$executeRawUnsafe(`
      UPDATE product_variants v
      SET price = pp.precio_mayorista
      FROM product_pricing pp
      WHERE pp.product_id = v."productId"
        AND pp.precio_mayorista IS NOT NULL AND pp.precio_mayorista > 0
    `);
    return NextResponse.json({ ok: true, actualizados: Number(upd ?? 0) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
