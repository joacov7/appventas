import Link from "next/link";
import { LayoutDashboard, Package, ShoppingBag, Store, LogOut } from "lucide-react";
import { auth, signOut } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col fixed h-full">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <Store size={20} className="text-emerald-600" />
            AppVentas Admin
          </div>
          {session?.user?.name && (
            <p className="text-xs text-gray-400 mt-1 truncate">{session.user.name}</p>
          )}
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
        <div className="p-4 border-t">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 w-full transition-colors"
            >
              <LogOut size={17} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
