export const dynamic = "force-dynamic";

import Link from "next/link";
import { Store } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/store/WhatsAppButton";
import { loadStoreConfig } from "@/lib/store-config";
import { getClienteSesion } from "@/lib/cliente-auth";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // En modo mayorista la tienda es cerrada: hay que registrarse para ver.
  const cfg = await loadStoreConfig().catch(() => null);
  if (cfg?.modoMayorista) {
    const ses = await getClienteSesion();
    if (!ses) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-md text-center space-y-4">
            <div className="flex justify-center"><div className="bg-emerald-50 p-3 rounded-2xl"><Store size={28} className="text-emerald-600" /></div></div>
            <h1 className="text-2xl font-bold text-gray-900">{cfg.storeName || "Regionales por Mayor"}</h1>
            <p className="text-sm text-gray-500">Somos <b>venta por mayor</b>. Para ver el catálogo y los precios, ingresá con tu cuenta mayorista o registrate.</p>
            <div className="flex flex-col gap-2 pt-1">
              <Link href="/portal/login" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl">Iniciar sesión</Link>
              <Link href="/portal/registro" className="border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium py-2.5 rounded-xl">Crear cuenta mayorista</Link>
            </div>
            <p className="text-xs text-gray-400">Aprobamos tu cuenta a la brevedad y ya podés comprar.</p>
          </div>
        </div>
      );
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
