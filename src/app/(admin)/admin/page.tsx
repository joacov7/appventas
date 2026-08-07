export const dynamic = "force-dynamic";

import Link from "next/link";
import { PackageCheck, ShoppingBag, MessageCircle, Users, AlertTriangle, DollarSign, ArrowRight } from "lucide-react";
import { BriefingCard } from "@/components/admin/BriefingCard";
import { resumenDashboard } from "@/lib/services/dashboard.service";

export default async function AdminDashboard() {
  const r = await resumenDashboard().catch(() => null);

  const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

  // Tarjetas accionables: lo del día, con enlace directo a cada sección.
  const cards = r ? [
    {
      href: "/admin/deposito", label: "Pedidos a armar", value: r.pedidosArmar,
      sub: r.pedidosSinArmar > 0 ? `${r.pedidosSinArmar} sin empezar` : "todo en marcha",
      icon: PackageCheck, color: "text-emerald-600 bg-emerald-50", alerta: r.pedidosSinArmar > 0,
    },
    {
      href: "/admin/ordenes", label: "Órdenes pendientes", value: r.ordenesPendientes,
      sub: "esperando gestión", icon: ShoppingBag, color: "text-blue-600 bg-blue-50", alerta: r.ordenesPendientes > 0,
    },
    {
      href: "/admin/bandeja", label: "Conversaciones sin responder", value: r.convSinResponder,
      sub: "en WhatsApp", icon: MessageCircle, color: "text-cyan-600 bg-cyan-50", alerta: r.convSinResponder > 0,
    },
    {
      href: "/admin/captacion", label: "Prospectos nuevos", value: r.prospectosNuevos,
      sub: "sin contactar", icon: Users, color: "text-violet-600 bg-violet-50", alerta: false,
    },
    {
      href: "/admin/productos", label: "Stock bajo / agotado", value: r.stockBajo + r.stockCero,
      sub: `${r.stockCero} en 0 · ${r.stockBajo} por agotarse`, icon: AlertTriangle,
      color: "text-amber-600 bg-amber-50", alerta: r.stockCero > 0,
    },
    {
      href: "/admin/analytics", label: "Ingresos del mes", value: money(r.ingresosMes),
      sub: "pagos aprobados", icon: DollarSign, color: "text-fuchsia-600 bg-fuchsia-50", alerta: false,
    },
  ] : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="mb-6">
        <BriefingCard />
      </div>

      {!r ? (
        <p className="text-sm text-gray-400">No se pudo cargar el resumen.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map(({ href, label, value, sub, icon: Icon, color, alerta }) => (
            <Link key={label} href={href}
              className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-emerald-200 hover:shadow-sm transition-all">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${color} relative`}>
                  <Icon size={22} />
                  {alerta && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
                <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
