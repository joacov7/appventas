"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Menu, X, Store } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { CartDrawer } from "@/components/store/CartDrawer";
import { Button } from "@/components/ui/Button";

export function Navbar() {
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const totalItems = useCartStore((s) => s.getTotalItems());

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <Store size={24} className="text-emerald-600" />
            <span>AppVentas</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/" className="hover:text-gray-900 transition-colors">Inicio</Link>
            <Link href="/productos" className="hover:text-gray-900 transition-colors">Catálogo</Link>
            <Link href="/virolas" className="hover:text-gray-900 transition-colors font-medium text-emerald-700">Personalizá tu virola</Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Abrir carrito"
            >
              <ShoppingBag size={22} />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-emerald-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-xl"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t px-4 py-3 space-y-1">
            <Link href="/" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700 hover:text-gray-900">Inicio</Link>
            <Link href="/productos" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700 hover:text-gray-900">Catálogo</Link>
            <Link href="/virolas" onClick={() => setMenuOpen(false)} className="block py-2 text-sm font-medium text-emerald-700">Personalizá tu virola</Link>
          </div>
        )}
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
