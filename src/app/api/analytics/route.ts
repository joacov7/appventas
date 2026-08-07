export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const [
    revenueApproved,
    totalOrders,
    approvedOrders,
    pendingOrders,
    topProducts,
    revenueByDay,
    ordersByStatus,
    abandonedStats,
  ] = await Promise.all([
    // Total revenue (approved transactions)
    prisma.transaction.aggregate({
      where: { status: "APPROVED" },
      _sum: { amount: true },
    }),

    // Order counts
    prisma.order.count(),
    prisma.order.count({ where: { status: "PROCESSING" } }),
    prisma.order.count({ where: { status: "PENDING" } }),

    // Top 10 products by revenue
    prisma.$queryRaw<
      { productId: string; name: string; totalQty: bigint; totalRevenue: string }[]
    >`
      SELECT oi."productId", p.name,
             SUM(oi.quantity)::bigint AS "totalQty",
             SUM(oi.subtotal)::text   AS "totalRevenue"
      FROM order_items oi
      JOIN products p ON p.id = oi."productId"
      GROUP BY oi."productId", p.name
      ORDER BY SUM(oi.subtotal) DESC
      LIMIT 10
    `,

    // Revenue last 30 days grouped by day
    prisma.$queryRaw<{ day: string; revenue: string; orders: bigint }[]>`
      SELECT DATE(o."createdAt")::text AS day,
             SUM(t.amount)::text       AS revenue,
             COUNT(DISTINCT o.id)::bigint AS orders
      FROM orders o
      JOIN transactions t ON t."orderId" = o.id AND t.status = 'APPROVED'
      WHERE o."createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(o."createdAt")
      ORDER BY day ASC
    `,

    // Orders by status
    prisma.$queryRaw<{ status: string; count: bigint }[]>`
      SELECT status, COUNT(*)::bigint AS count FROM orders GROUP BY status ORDER BY count DESC
    `,

    // Abandoned cart funnel
    prisma.$queryRaw<{ estado: string; cantidad: bigint; total: string }[]>`
      SELECT estado, COUNT(*)::bigint AS cantidad, SUM(total)::text AS total
      FROM carritos_abandonados
      GROUP BY estado
      ORDER BY estado
    `.catch(() => []),
  ]);

  const revenue = Number(revenueApproved._sum.amount ?? 0);
  const avgTicket = approvedOrders > 0 ? revenue / approvedOrders : 0;
  const conversionRate = totalOrders > 0 ? (approvedOrders / totalOrders) * 100 : 0;

  return NextResponse.json({
    summary: { revenue, totalOrders, approvedOrders, pendingOrders, avgTicket, conversionRate },
    topProducts: topProducts.map((p) => ({
      productId: p.productId,
      name: p.name,
      totalQty: Number(p.totalQty),
      totalRevenue: Number(p.totalRevenue),
    })),
    revenueByDay: revenueByDay.map((r) => ({
      day: r.day,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
    })),
    ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: Number(s.count) })),
    abandonedStats: (abandonedStats as any[]).map((a) => ({
      estado: a.estado,
      cantidad: Number(a.cantidad),
      total: Number(a.total ?? 0),
    })),
  });
}
