import Link from "next/link";
import { LayoutDashboard, Package, ShoppingBag, Store } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // TODO: reactivar auth cuando configures Google OAuth
  // const session = await auth();
  // if (!session || session.user?.role !== "ADMIN") redirect("/");

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col fixed h-full">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <Store size={20} className="text-emerald-600" />
            AppVentas Admin
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
            { href: "/admin/productos", label: "Productos", icon: Package },
            { href: "/admin/ordenes", label: "Órdenes", icon: ShoppingBag },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
