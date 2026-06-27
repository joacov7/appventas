"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  TrendingUp, ShoppingBag, DollarSign, Percent,
  Clock, Mail, MailCheck, MailX, ShoppingCart,
} from "lucide-react";

function formatARS(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

interface Analytics {
  summary: {
    revenue: number;
    totalOrders: number;
    approvedOrders: number;
    pendingOrders: number;
    avgTicket: number;
    conversionRate: number;
  };
  topProducts: { productId: string; name: string; totalQty: number; totalRevenue: number }[];
  revenueByDay: { day: string; revenue: number; orders: number }[];
  ordersByStatus: { status: string; count: number }[];
  abandonedStats: { estado: string; cantidad: number; total: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  PROCESSING: "Procesando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const ABANDONED_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendiente:   { label: "En carrito",       color: "bg-amber-100 text-amber-700",   icon: ShoppingCart },
  email_2h:    { label: "Email 2h enviado", color: "bg-blue-100 text-blue-700",     icon: Mail },
  email_24h:   { label: "Email 24h enviado",color: "bg-violet-100 text-violet-700", icon: MailCheck },
  convertido:  { label: "Convertido",       color: "bg-emerald-100 text-emerald-700",icon: MailX },
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Error al cargar analytics.</p>;

  const { summary, topProducts, revenueByDay, ordersByStatus, abandonedStats } = data;

  const maxRevenue = Math.max(...revenueByDay.map((d) => d.revenue), 1);
  const maxProductRevenue = topProducts[0]?.totalRevenue ?? 1;

  const summaryCards = [
    { label: "Ingresos totales",    value: formatARS(summary.revenue),         icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
    { label: "Órdenes pagadas",     value: summary.approvedOrders,              icon: ShoppingBag, color: "text-blue-600 bg-blue-50" },
    { label: "Ticket promedio",     value: formatARS(summary.avgTicket),        icon: TrendingUp, color: "text-violet-600 bg-violet-50" },
    { label: "Tasa de conversión",  value: `${summary.conversionRate.toFixed(1)}%`, icon: Percent, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${color}`}><Icon size={20} /></div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue last 30 days */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ingresos últimos 30 días</h2>
          {revenueByDay.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos aún</p>
          ) : (
            <div className="flex items-end gap-1 h-36">
              {revenueByDay.map((d) => {
                const height = Math.max((d.revenue / maxRevenue) * 100, 2);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-emerald-500 rounded-t-sm group-hover:bg-emerald-600 transition-colors cursor-default"
                      style={{ height: `${height}%` }}
                    />
                    {/* tooltip */}
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap">
                        {d.day.slice(5)}<br />{formatARS(d.revenue)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Orders by status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Órdenes por estado</h2>
          <div className="space-y-3">
            {ordersByStatus.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos aún</p>
            ) : ordersByStatus.map(({ status, count }) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{STATUS_LABELS[status] ?? status}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{ width: `${(count / summary.totalOrders) * 100}%` }}
                    />
                  </div>
                  <span className="font-semibold text-gray-900 w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top products */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Mejores productos</h2>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin ventas aún</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.productId} className="flex items-center gap-4">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-800 font-medium line-clamp-1">{p.name}</span>
                    <span className="text-sm font-bold text-emerald-600 ml-2 shrink-0">{formatARS(p.totalRevenue)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${(p.totalRevenue / maxProductRevenue) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0 w-14 text-right">{p.totalQty} uds.</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abandoned cart funnel */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Recuperación de carritos abandonados</h2>
        {abandonedStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos aún</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {abandonedStats.map(({ estado, cantidad, total }) => {
              const meta = ABANDONED_LABELS[estado] ?? { label: estado, color: "bg-gray-100 text-gray-600", icon: Clock };
              const Icon = meta.icon;
              return (
                <div key={estado} className={`rounded-xl p-4 ${meta.color}`}>
                  <Icon size={18} className="mb-2" />
                  <p className="text-lg font-bold">{cantidad}</p>
                  <p className="text-xs font-medium">{meta.label}</p>
                  <p className="text-xs mt-1 opacity-70">{formatARS(total)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
