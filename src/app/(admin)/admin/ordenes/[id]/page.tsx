export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatPrice } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente", PROCESSING: "En proceso", SHIPPED: "Enviado",
  DELIVERED: "Entregado", CANCELLED: "Cancelado", REFUNDED: "Reembolsado",
};
const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning", PROCESSING: "info", SHIPPED: "info",
  DELIVERED: "success", CANCELLED: "danger", REFUNDED: "default",
};
const TX_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  APPROVED: "success", PENDING: "warning", IN_PROCESS: "info",
  REJECTED: "danger", CANCELLED: "danger", REFUNDED: "default",
};

type Params = { params: Promise<{ id: string }> };

export default async function OrdenDetailPage({ params }: Params) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: { select: { name: true, slug: true } },
          variant: { select: { name: true } },
        },
      },
      transactions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) notFound();

  const address = order.shippingAddress as Record<string, string> | null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/ordenes" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orden #{id.slice(0, 8)}</h1>
          <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString("es-AR")}</p>
        </div>
        <Badge variant={STATUS_VARIANT[order.status] ?? "default"}>
          {STATUS_LABEL[order.status] ?? order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cliente */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="font-semibold text-gray-900 mb-3">Cliente</h2>
          <p className="text-sm text-gray-600">{order.guestEmail ?? order.userId ?? "—"}</p>
          {address && (
            <div className="text-sm text-gray-600 space-y-1 pt-2 border-t border-gray-50">
              <p className="font-medium">{address.fullName}</p>
              <p>{address.street}</p>
              <p>{address.city}, {address.province} {address.postalCode}</p>
              <p>{address.phone}</p>
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <h2 className="font-semibold text-gray-900 mb-3">Resumen</h2>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>{formatPrice(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Envío</span><span>{formatPrice(Number(order.shippingCost))}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-gray-100 pt-2">
            <span>Total</span><span>{formatPrice(Number(order.total))}</span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Productos</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-sm">
              <div>
                <p className="font-medium text-gray-900">{item.product.name}</p>
                <p className="text-gray-500">{item.variant.name} × {item.quantity}</p>
              </div>
              <p className="font-semibold">{formatPrice(Number(item.subtotal))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transacciones MP */}
      {order.transactions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Pagos (Mercado Pago)</h2>
          <div className="space-y-3">
            {order.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-mono text-gray-500 text-xs">{tx.mpPaymentId ?? tx.mpPreferenceId ?? "—"}</p>
                  <p className="text-gray-600">{tx.paymentMethodId ?? "—"} · {tx.statusDetail ?? "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {tx.amount && <span className="font-semibold">{formatPrice(Number(tx.amount))}</span>}
                  <Badge variant={TX_VARIANT[tx.status] ?? "default"}>{tx.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800">
          <strong>Notas:</strong> {order.notes}
        </div>
      )}
    </div>
  );
}
