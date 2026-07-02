"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, Store, LogOut, Tag, Truck, Images,
  Users, BarChart2, Mail, Layers, Gift, RefreshCw, MessageCircle, TrendingDown,
  CircleDot, BookOpen, Megaphone, Menu, X, Settings,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/hero", label: "Hero Slider", icon: Images },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/ordenes", label: "Órdenes", icon: ShoppingBag },
  { href: "/admin/cupones", label: "Cupones", icon: Tag },
  { href: "/admin/envios", label: "Envíos", icon: Truck },
  { href: "/admin/captacion", label: "Captación", icon: Users },
  { href: "/admin/captacion/meta", label: "Meta Ads", icon: Megaphone },
  { href: "/admin/inteligencia", label: "Inteligencia", icon: TrendingDown },
  { href: "/admin/virolas", label: "Virolas", icon: CircleDot },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/mayorista", label: "Mayorista", icon: Layers },
  { href: "/admin/referidos", label: "Referidos", icon: Gift },
  { href: "/admin/suscripciones", label: "Reposiciones", icon: RefreshCw },
  { href: "/admin/whatsapp", label: "Bot WhatsApp", icon: MessageCircle },
  { href: "/admin/combos", label: "Combos", icon: Gift },
  { href: "/admin/catalogos", label: "Catálogos", icon: BookOpen },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
              active
                ? "bg-emerald-50 text-emerald-700 font-medium"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Icon size={17} className={active ? "text-emerald-600" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const currentPage = NAV.find(n => n.href === pathname || (n.href !== "/admin" && pathname.startsWith(n.href)));

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-100 flex-col fixed h-full z-30">
        <div className="p-5 border-b shrink-0">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <Store size={20} className="text-emerald-600" />
            AppVentas Admin
          </div>
        </div>
        <NavLinks pathname={pathname} />
        <div className="p-4 border-t shrink-0">
          <form action="/api/auth/admin-logout" method="POST">
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

      {/* ── Mobile overlay ── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <Store size={20} className="text-emerald-600" />
            AppVentas Admin
          </div>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        <div className="p-4 border-t shrink-0">
          <form action="/api/auth/admin-logout" method="POST">
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

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-60">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
            <Store size={17} className="text-emerald-600" />
            {currentPage?.label ?? "Admin"}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
