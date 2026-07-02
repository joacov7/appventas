export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// Posición competitiva: por cada producto propio con links confirmados,
// compara mi precio contra el mercado y calcula margen usando el costo real.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  let rows: any[] = [];
  try {
    rows = await (prisma as any).$queryRawUnsafe(`
      SELECT
        pr.id            AS product_id,
        pr.name          AS producto,
        pr.slug,
        (SELECT MIN(v.price)::float FROM product_variants v
          WHERE v."productId" = pr.id AND v.active = TRUE)     AS mi_precio,
        pp.costo::float                                        AS costo,
        COUNT(pc.id)::int                                      AS competidores,
        MIN(pc.precio)::float                                  AS mercado_min,
        AVG(pc.precio)::float                                  AS mercado_prom,
        MAX(pc.precio)::float                                  AS mercado_max,
        COUNT(CASE WHEN pc.precio_anterior IS NOT NULL
                    AND pc.precio < pc.precio_anterior THEN 1 END)::int AS bajadas_recientes
      FROM producto_competidor_links l
      JOIN products pr             ON pr.id = l.product_id
      JOIN productos_competidores pc ON pc.id = l.competidor_id AND pc.disponible = TRUE
      LEFT JOIN product_pricing pp ON pp.product_id = pr.id
      WHERE l.estado = 'confirmado'
      GROUP BY pr.id, pr.name, pr.slug, pp.costo
      ORDER BY pr.name
    `);
  } catch {
    return NextResponse.json([]);
  }

  const result = rows.map(r => {
    const miPrecio = r.mi_precio != null ? Number(r.mi_precio) : null;
    const prom = r.mercado_prom != null ? Number(r.mercado_prom) : null;
    const costo = r.costo != null ? Number(r.costo) : null;

    // % vs promedio de mercado (positivo = estoy más caro)
    const posicionPct = miPrecio != null && prom ? ((miPrecio - prom) / prom) * 100 : null;
    // Margen actual sobre mi precio
    const margenPct = miPrecio != null && costo != null && miPrecio > 0
      ? ((miPrecio - costo) / miPrecio) * 100 : null;
    // Precio para igualar al mínimo de mercado, y el margen que quedaría
    const mercadoMin = r.mercado_min != null ? Number(r.mercado_min) : null;
    const margenSiIgualo = mercadoMin != null && costo != null && mercadoMin > 0
      ? ((mercadoMin - costo) / mercadoMin) * 100 : null;

    return {
      product_id: r.product_id,
      producto: r.producto,
      slug: r.slug,
      mi_precio: miPrecio,
      costo,
      competidores: r.competidores,
      mercado_min: mercadoMin,
      mercado_prom: prom,
      mercado_max: r.mercado_max != null ? Number(r.mercado_max) : null,
      posicion_pct: posicionPct,
      margen_pct: margenPct,
      margen_si_igualo_min: margenSiIgualo,
      bajadas_recientes: r.bajadas_recientes,
    };
  });

  return NextResponse.json(result);
}
