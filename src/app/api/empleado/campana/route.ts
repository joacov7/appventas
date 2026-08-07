export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { generarCampana } from "@/lib/services/campana.service";

// ─── GET: productos candidatos para campaña, rankeados ───────────────────────
// Estrategia "ventas": mejor margen × ventas recientes (empujar lo que funciona)
// Estrategia "rotacion": productos con margen pero sin ventas (destrabar stock)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT
        p.id, p.name, p.slug, p."imageUrls",
        (SELECT MIN(v.price)::float FROM product_variants v
          WHERE v."productId" = p.id AND v.active = TRUE)        AS precio,
        pp.costo::float                                          AS costo,
        COALESCE((
          SELECT SUM(oi.quantity)::int FROM order_items oi
          JOIN orders o ON o.id = oi."orderId"
          WHERE oi."productId" = p.id AND o."createdAt" >= NOW() - INTERVAL '30 days'
            AND o.status IN ('PROCESSING','SHIPPED','DELIVERED')
        ), 0)                                                    AS ventas_30d
      FROM products p
      LEFT JOIN product_pricing pp ON pp.product_id = p.id
      WHERE p.active = TRUE
    `);

    const candidatos = rows
      .filter(r => r.precio != null && r.precio > 0)
      .map(r => {
        const margenPct = r.costo != null ? ((r.precio - r.costo) / r.precio) * 100 : null;
        return {
          id: r.id,
          nombre: r.name,
          slug: r.slug,
          imagen: r.imageUrls?.[0] ?? null,
          precio: Number(r.precio),
          costo: r.costo != null ? Number(r.costo) : null,
          margen_pct: margenPct,
          ventas_30d: r.ventas_30d,
          // Score ventas: margen (o 30 por defecto) ponderado por ventas
          score_ventas: (margenPct ?? 30) * (1 + r.ventas_30d),
        };
      });

    const paraVentas = [...candidatos].sort((a, b) => b.score_ventas - a.score_ventas).slice(0, 8);
    const paraRotacion = candidatos
      .filter(c => c.ventas_30d === 0 && (c.margen_pct == null || c.margen_pct > 20))
      .slice(0, 8);

    return NextResponse.json({ ventas: paraVentas, rotacion: paraRotacion });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ─── POST: generar borrador de campaña completo para un producto ─────────────
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { productId, estrategia, ocasion } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId requerido" }, { status: 400 });
  const res = await generarCampana(String(productId), { estrategia, ocasion });
  return NextResponse.json(res, { status: res.ok ? 201 : 500 });
}
