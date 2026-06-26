import Link from "next/link";
import { Store } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg text-gray-900 mb-3">
              <Store size={20} className="text-emerald-600" />
              AppVentas
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tu tienda online. Productos de calidad con envío a todo el país.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Tienda</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/" className="hover:text-gray-900">Inicio</Link></li>
              <li><Link href="/productos" className="hover:text-gray-900">Catálogo</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Ayuda</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/checkout/exito" className="hover:text-gray-900">Seguimiento de pedido</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-8 pt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} AppVentas. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
