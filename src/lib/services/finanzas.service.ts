import { prisma } from "@/lib/prisma";

export interface ResumenFinanciero {
  ingresos_aprobados_total: number;
  ingresos_30d: number;
  ordenes_total: number;
  ordenes_pagadas: number;
  ordenes_pendientes: number;
  ticket_promedio: number | null;
  pendiente_de_cobro: number;
}

// Resumen financiero desde órdenes y transacciones. 100% determinístico.
export async function resumenFinanciero(): Promise<ResumenFinanciero> {
  const hace30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [aprobadoTotal, aprobado30d, ordenesTotal, pendientes, pagadas, pendienteMonto] = await Promise.all([
    prisma.transaction.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { status: "APPROVED", createdAt: { gte: hace30d } }, _sum: { amount: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] } } }),
    prisma.order.aggregate({ where: { status: "PENDING" }, _sum: { total: true } }),
  ]);

  const ingresos = Number(aprobadoTotal._sum.amount ?? 0);
  return {
    ingresos_aprobados_total: ingresos,
    ingresos_30d: Number(aprobado30d._sum.amount ?? 0),
    ordenes_total: ordenesTotal,
    ordenes_pagadas: pagadas,
    ordenes_pendientes: pendientes,
    ticket_promedio: pagadas > 0 ? ingresos / pagadas : null,
    pendiente_de_cobro: Number(pendienteMonto._sum.total ?? 0),
  };
}

// Productos candidatos a promocionar: mejor margen ponderado por ventas 30d.
export interface CandidatoPromo {
  id: string; nombre: string; precio: number; margen_pct: number | null; ventas_30d: number; score: number;
}
export async function productosParaPromocionar(limit = 8): Promise<CandidatoPromo[]> {
  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    SELECT p.id, p.name,
      (SELECT MIN(v.price)::float FROM product_variants v WHERE v."productId" = p.id AND v.active = TRUE) AS precio,
      pp.costo::float AS costo,
      COALESCE((
        SELECT SUM(oi.quantity)::int FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        WHERE oi."productId" = p.id AND o."createdAt" >= NOW() - INTERVAL '30 days'
          AND o.status IN ('PROCESSING','SHIPPED','DELIVERED')
      ), 0) AS ventas_30d
    FROM products p
    LEFT JOIN product_pricing pp ON pp.product_id = p.id
    WHERE p.active = TRUE
  `).catch(() => []);

  return rows
    .filter(r => r.precio > 0)
    .map(r => {
      const margen = r.costo != null ? ((r.precio - r.costo) / r.precio) * 100 : null;
      return {
        id: r.id, nombre: r.name, precio: Number(r.precio),
        margen_pct: margen, ventas_30d: r.ventas_30d,
        score: (margen ?? 30) * (1 + r.ventas_30d),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
