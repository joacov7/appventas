export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const MARGEN_PISO_PCT = 15; // nunca sugerir un precio con margen menor a esto

type Sugerencia = { precio: number; motivo: string; margen_resultante: number | null } | null;

function redondear(n: number): number {
  return Math.round(n / 100) * 100;
}

// Sugerencia determinística: alinear al mercado sin perforar el margen piso.
function calcularSugerencia(
  miPrecio: number | null, costo: number | null,
  mercadoMin: number | null, prom: number | null
): Sugerencia {
  if (miPrecio == null || !prom || !mercadoMin) return null;
  const piso = costo != null ? costo / (1 - MARGEN_PISO_PCT / 100) : null;
  const margenDe = (precio: number) =>
    costo != null && precio > 0 ? ((precio - costo) / precio) * 100 : null;

  // Estoy caro: >3% sobre el promedio → bajar hacia el promedio (respetando piso)
  if (miPrecio > prom * 1.03) {
    let objetivo = redondear(prom);
    if (piso != null && objetivo < piso) objetivo = redondear(piso);
    if (objetivo >= miPrecio) return null; // el piso no me deja bajar
    return {
      precio: objetivo,
      motivo: `Estás ${(((miPrecio - prom) / prom) * 100).toFixed(0)}% arriba del promedio del mercado`,
      margen_resultante: margenDe(objetivo),
    };
  }

  // Estoy regalando: >5% debajo del mínimo del mercado → subir cerca del mínimo
  if (miPrecio < mercadoMin * 0.95) {
    const objetivo = redondear(mercadoMin * 0.99);
    if (objetivo <= miPrecio) return null;
    return {
      precio: objetivo,
      motivo: `Estás debajo del competidor más barato (${new Intl.NumberFormat("es-AR").format(mercadoMin)}) — estás dejando plata`,
      margen_resultante: margenDe(objetivo),
    };
  }

  return null; // alineado: no tocar
}

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
      sugerencia: calcularSugerencia(miPrecio, costo, mercadoMin, prom),
    };
  });

  return NextResponse.json(result);
}
