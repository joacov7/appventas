import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PROCESSING: "En proceso",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "default",
};

export default async function OrdenesPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Órdenes</h1>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["ID", "Email", "Items", "Total", "Estado", "Fecha"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.id.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-gray-700">{order.guestEmail ?? order.userId ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{order._count.items}</td>
                <td className="px-4 py-3 font-semibold">
                  {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(Number(order.total))}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[order.status] ?? "default"}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="text-center py-12 text-gray-400">No hay órdenes aún.</div>
        )}
      </div>
    </div>
  );
}
