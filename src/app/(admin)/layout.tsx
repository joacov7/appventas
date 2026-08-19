"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, Store, LogOut, Tag, Truck, Images,
  Users, BarChart2, Mail, Layers, Gift, RefreshCw, MessageCircle, TrendingDown,
  CircleDot, BookOpen, Megaphone, Menu, X, Settings, Bot, Brain, Cpu, CheckSquare, Factory, Calculator, CalendarDays, Inbox, Clock, Heart, Receipt, HelpCircle, Wand2, Bell, PackageCheck, Eraser, Info, Tags, Film, Target, DollarSign, Handshake, Briefcase, KanbanSquare, ScrollText, ListChecks,
} from "lucide-react";

const GRUPOS = [
  { grupo: "General", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/ayuda", label: "Ayuda", icon: HelpCircle },
  ] },
  { grupo: "Catálogo", items: [
    { href: "/admin/productos", label: "Productos", icon: Package },
    { href: "/admin/categorias", label: "Categorías", icon: Tags },
    { href: "/admin/fabricantes", label: "Fabricantes", icon: Factory },
    { href: "/admin/personalizados", label: "Personalizados (mockup)", icon: Wand2 },
    { href: "/admin/quitar-fondo", label: "Quitar fondo", icon: Eraser },
    { href: "/admin/combos", label: "Combos", icon: Gift },
    { href: "/admin/catalogos", label: "Catálogos", icon: BookOpen },
    { href: "/admin/virolas", label: "Virolas", icon: CircleDot },
    { href: "/admin/hero", label: "Hero Slider", icon: Images },
  ] },
  { grupo: "Ventas", items: [
    { href: "/admin/cotizador", label: "Cotizador", icon: Calculator },
    { href: "/admin/calculadora-ml", label: "Calculadora ML", icon: Calculator },
    { href: "/admin/titulos-ml", label: "Títulos ML (IA)", icon: Megaphone },
    { href: "/admin/ordenes", label: "Órdenes", icon: ShoppingBag },
    { href: "/admin/pipeline", label: "Pipeline de ventas", icon: KanbanSquare },
    { href: "/admin/deposito", label: "Depósito", icon: PackageCheck },
    { href: "/admin/ventas", label: "Ventas manuales", icon: Receipt },
    { href: "/admin/mayorista", label: "Mayorista", icon: Layers },
    { href: "/admin/clientes", label: "Clientes mayoristas", icon: Store },
    { href: "/admin/cupones", label: "Cupones", icon: Tag },
    { href: "/admin/envios", label: "Envíos", icon: Truck },
  ] },
  { grupo: "Clientes", items: [
    { href: "/admin/bandeja", label: "Bandeja", icon: Inbox },
    { href: "/admin/captacion", label: "Captación", icon: Users },
    { href: "/admin/seguimiento", label: "Seguimiento", icon: Clock },
    { href: "/admin/postventa", label: "Postventa", icon: Heart },
    { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
    { href: "/admin/referidos", label: "Referidos", icon: Gift },
    { href: "/admin/suscripciones", label: "Reposiciones", icon: RefreshCw },
  ] },
  { grupo: "Marketing e Inteligencia", items: [
    { href: "/admin/marketing", label: "Marketing", icon: CalendarDays },
    { href: "/admin/idea-viral", label: "Idea viral", icon: Target },
    { href: "/admin/videos", label: "Videos para redes", icon: Film },
    { href: "/admin/captacion/meta", label: "Meta Ads", icon: Megaphone },
    { href: "/admin/inteligencia", label: "Inteligencia", icon: TrendingDown },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  ] },
  { grupo: "Empresa IA", items: [
    { href: "/admin/jefe", label: "Jefe de Gabinete", icon: Briefcase },
    { href: "/admin/agentes", label: "Agentes", icon: Bot },
    { href: "/admin/ventas-agente", label: "Gerente de Ventas", icon: Handshake },
    { href: "/admin/decisiones", label: "Centro de Decisiones", icon: ListChecks },
    { href: "/admin/aprobaciones", label: "Aprobaciones", icon: CheckSquare },
    { href: "/admin/bitacora", label: "Bitácora de agentes", icon: ScrollText },
    { href: "/admin/ia", label: "Inteligencia Artificial", icon: Cpu },
    { href: "/admin/ia-gasto", label: "Gasto de IA", icon: DollarSign },
    { href: "/admin/memoria", label: "Memoria", icon: Brain },
  ] },
  { grupo: "Sistema", items: [
    { href: "/admin/usuarios", label: "Usuarios y roles", icon: Users },
    { href: "/admin/aclaraciones", label: "Aclaraciones", icon: Info },
    { href: "/admin/whatsapp", label: "Bot WhatsApp", icon: MessageCircle },
    { href: "/admin/telegram", label: "Avisos Telegram", icon: Bell },
    { href: "/admin/configuracion", label: "Configuración", icon: Settings },
  ] },
];

// Secciones visibles para roles no-admin (debe coincidir con el middleware).
const PERMISOS_POR_ROL: Record<string, string[]> = {
  deposito: ["/admin/deposito"],
};

// Filtra los grupos/ítems del menú según el rol. El admin ve todo.
function gruposParaRol(rol: string | null) {
  if (!rol || rol === "admin") return GRUPOS;
  const permitidas = PERMISOS_POR_ROL[rol] ?? [];
  return GRUPOS
    .map(g => ({ ...g, items: g.items.filter(i => permitidas.some(p => i.href === p || i.href.startsWith(p + "/"))) }))
    .filter(g => g.items.length > 0);
}

// Lista plana derivada, para resolver la página actual (encabezado móvil).
const NAV = GRUPOS.flatMap(g => g.items);

function NavLinks({ pathname, rol, onNavigate }: { pathname: string; rol: string | null; onNavigate?: () => void }) {
  const grupos = gruposParaRol(rol);
  return (
    <nav className="flex-1 p-3 overflow-y-auto">
      {grupos.map(({ grupo, items }) => (
        <div key={grupo} className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">{grupo}</p>
          <div className="space-y-0.5">
            {items.map(({ href, label, icon: Icon }) => {
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
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rol, setRol] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setRol(d.rol ?? null)).catch(() => {});
  }, []);

  const currentPage = NAV.find(n => n.href === pathname || (n.href !== "/admin" && pathname.startsWith(n.href)));

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-100 flex-col fixed h-full z-30">
        <div className="p-5 border-b shrink-0">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <Store size={20} className="text-emerald-600" />
            Regionales por Mayor Admin
          </div>
        </div>
        <NavLinks pathname={pathname} rol={rol} />
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
            Regionales por Mayor Admin
          </div>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <NavLinks pathname={pathname} rol={rol} onNavigate={() => setOpen(false)} />
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
