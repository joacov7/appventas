export const dynamic = "force-dynamic";

import Link from "next/link";
import { ShoppingBag, ClipboardList, ArrowRight } from "lucide-react";
import { getClienteSesion } from "@/lib/cliente-auth";
import { PortalHeader } from "./PortalHeader";

export default async function PortalHome() {
  const ses = await getClienteSesion();

  return (
    <>
      <PortalHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hola 👋</h1>
          <p className="text-sm text-gray-500">{ses?.email} · precios mayoristas</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/productos"
            className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-emerald-200 hover:shadow-sm transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><ShoppingBag size={22} /></div>
              <div>
                <p className="font-semibold text-gray-900">Ver catálogo y pedir</p>
                <p className="text-xs text-gray-500">Con precios mayoristas</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-emerald-500" />
            </div>
          </Link>

          <Link href="/portal/pedidos"
            className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-emerald-200 hover:shadow-sm transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600"><ClipboardList size={22} /></div>
              <div>
                <p className="font-semibold text-gray-900">Mis pedidos</p>
                <p className="text-xs text-gray-500">Historial y repetir</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-gray-300 group-hover:text-emerald-500" />
            </div>
          </Link>
        </div>

        <p className="text-xs text-gray-400">
          Para que tus pedidos queden asociados a tu cuenta, usá el mismo email (<b>{ses?.email}</b>) al finalizar la compra en el catálogo.
        </p>
      </main>
    </>
  );
}
