import Link from "next/link";
import { Store, LogOut } from "lucide-react";

// Encabezado del portal mayorista (marca + salir). Server component.
export function PortalHeader() {
  return (
    <header className="bg-white border-b sticky top-0 z-20">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
        <Link href="/portal" className="flex items-center gap-2 font-bold text-gray-900">
          <Store size={20} className="text-emerald-600" />
          Regionales por Mayor
        </Link>
        <form action="/api/portal/logout" method="POST" className="ml-auto">
          <button type="submit" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600">
            <LogOut size={15} /> Salir
          </button>
        </form>
      </div>
    </header>
  );
}
