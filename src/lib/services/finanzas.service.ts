import { prisma } from "@/lib/prisma";
import { totalesVentasRegistradas } from "./ventas.service";

export interface ResumenFinanciero {
  ingresos_aprobados_total: number;   // web + ventas registradas
  ingresos_30d: number;
  ordenes_total: number;
  ordenes_pagadas: number;
  ordenes_pendientes: number;
  ticket_promedio: number | null;
  pendiente_de_cobro: number;
  ventas_offline_total: number;       // ventas cargadas fuera de la web
  ventas_offline_30d: number;
}

// Resumen financiero desde órdenes, transacciones y ventas registradas. Determinístico.
export async function resumenFinanciero(): Promise<ResumenFinanciero> {
  const hace30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [aprobadoTotal, aprobado30d, ordenesTotal, pendientes, pagadas, pendienteMonto, offline] = await Promise.all([
    prisma.transaction.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { status: "APPROVED", createdAt: { gte: hace30d } }, _sum: { amount: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] } } }),
    prisma.order.aggregate({ where: { status: "PENDING" }, _sum: { total: true } }),
    totalesVentasRegistradas(),
  ]);

  const ingresosWeb = Number(aprobadoTotal._sum.amount ?? 0);
  const ingresos = ingresosWeb + offline.total;
  const pagadasTotal = pagadas + offline.cantidad;
  return {
    ingresos_aprobados_total: ingresos,
    ingresos_30d: Number(aprobado30d._sum.amount ?? 0) + offline.total_30d,
    ordenes_total: ordenesTotal + offline.cantidad,
    ordenes_pagadas: pagadasTotal,
    ordenes_pendientes: pendientes,
    ticket_promedio: pagadasTotal > 0 ? ingresos / pagadasTotal : null,
    pendiente_de_cobro: Number(pendienteMonto._sum.total ?? 0),
    ventas_offline_total: offline.total,
    ventas_offline_30d: offline.total_30d,
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

// ─── Rentabilidad por producto (Fase 5A): margen, rotación e inmovilizado ────
// Determinístico, 0 tokens. Reutiliza el mismo cruce products + pricing + ventas
// que "promocionar", sumando el stock para calcular el capital inmovilizado.
export interface RentabilidadItem {
  id: string; nombre: string; precio: number; costo: number | null;
  margen_pct: number | null; ventas_30d: number; stock: number; valor_inmovilizado: number | null;
}
export async function analisisRentabilidad(): Promise<RentabilidadItem[]> {
  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    SELECT p.id, p.name,
      (SELECT MIN(v.price)::float FROM product_variants v WHERE v."productId" = p.id AND v.active = TRUE) AS precio,
      (SELECT COALESCE(SUM(v.stock),0)::int FROM product_variants v WHERE v."productId" = p.id AND v.active = TRUE) AS stock,
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
    .filter(r => r.precio != null && r.precio > 0)
    .map(r => {
      const precio = Number(r.precio);
      const costo = r.costo != null ? Number(r.costo) : null;
      const margen = costo != null ? ((precio - costo) / precio) * 100 : null;
      const stock = Number(r.stock ?? 0);
      return {
        id: r.id, nombre: r.name, precio, costo,
        margen_pct: margen != null ? Math.round(margen * 10) / 10 : null,
        ventas_30d: Number(r.ventas_30d ?? 0), stock,
        valor_inmovilizado: costo != null ? Math.round(stock * costo) : null,
      };
    });
}
