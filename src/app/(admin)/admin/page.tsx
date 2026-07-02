export const dynamic = "force-dynamic";

import { Package, ShoppingBag, DollarSign, Users } from "lucide-react";
import { BriefingCard } from "@/components/admin/BriefingCard";

async function getStats() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const [totalProducts, totalOrders, pendingOrders, approvedTransactionsAgg] =
      await Promise.all([
        prisma.product.count({ where: { active: true } }),
        prisma.order.count(),
        prisma.order.count({ where: { status: "PENDING" } }),
        prisma.transaction.aggregate({
          where: { status: "APPROVED" },
          _sum: { amount: true },
        }),
      ]);
    return { totalProducts, totalOrders, pendingOrders, revenue: Number(approvedTransactionsAgg._sum.amount ?? 0) };
  } catch {
    return { totalProducts: 0, totalOrders: 0, pendingOrders: 0, revenue: 0 };
  }
}

export default async function AdminDashboard() {
  const { totalProducts, totalOrders, pendingOrders, revenue } = await getStats();

  const stats = [
    { label: "Productos activos", value: totalProducts, icon: Package, color: "text-emerald-600 bg-emerald-50" },
    { label: "Total órdenes", value: totalOrders, icon: ShoppingBag, color: "text-blue-600 bg-blue-50" },
    { label: "Órdenes pendientes", value: pendingOrders, icon: Users, color: "text-amber-600 bg-amber-50" },
    {
      label: "Ingresos aprobados",
      value: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(revenue),
      icon: DollarSign,
      color: "text-violet-600 bg-violet-50",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>
      <div className="mb-6">
        <BriefingCard />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
