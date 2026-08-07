export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Recalcula el precio MINORISTA a partir del MAYORISTA + un % de recargo.
// minorista = mayorista × (1 + markup/100). Rápido (SQL masivo), reutilizable.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { markup, redondeo } = await req.json();
  const pct = Number(markup);
  const step = Number(redondeo) > 0 ? Number(redondeo) : 100; // redondea a múltiplos de $100 por defecto
  if (!Number.isFinite(pct) || pct < 0) return NextResponse.json({ error: "Markup inválido" }, { status: 400 });

  try {
    await ensureSchema("pricing");
    const factor = 1 + pct / 100;
    // minorista = redondeado(mayorista × factor) al múltiplo de `step` más cercano.
    const expr = `GREATEST(ROUND(precio_mayorista * ${factor} / ${step}) * ${step}, ${step})`;
    const exprV = `GREATEST(ROUND(pp.precio_mayorista * ${factor} / ${step}) * ${step}, ${step})`;

    // 1) Precio minorista en product_pricing.
    const upd: any = await (prisma as any).$executeRawUnsafe(
      `UPDATE product_pricing
       SET precio_minorista = ${expr}, updated_at = now()
       WHERE precio_mayorista IS NOT NULL AND precio_mayorista > 0`
    );

    // 2) Precio visible de la variante (lo que muestra la tienda pública).
    await (prisma as any).$executeRawUnsafe(
      `UPDATE product_variants v
       SET price = ${exprV}
       FROM product_pricing pp
       WHERE pp.product_id = v."productId" AND pp.precio_mayorista IS NOT NULL AND pp.precio_mayorista > 0`
    );

    return NextResponse.json({ ok: true, actualizados: Number(upd ?? 0), markup: pct, redondeo: step });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
