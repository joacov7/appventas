"use client";

import { X, ShoppingBag, Trash2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import Image from "next/image";
import Link from "next/link";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, getTotalPrice, getTotalItems } =
    useCartStore();

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} />
            <span className="font-semibold text-lg">Tu carrito</span>
            {getTotalItems() > 0 && (
              <span className="bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {getTotalItems()}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <ShoppingBag size={48} strokeWidth={1} />
              <p className="text-sm">Tu carrito está vacío</p>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Seguir comprando
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.variantId} className="flex gap-3 items-start">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                  <Image
                    src={item.imageUrl ?? "/images/placeholder.png"}
                    alt={item.productName}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 line-clamp-1">
                    {item.productName}
                  </p>
                  <p className="text-xs text-gray-500">{item.variantName}</p>
                  <p className="text-sm font-semibold text-emerald-700 mt-1">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => removeItem(item.variantId)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  <div className="flex items-center gap-1.5 border rounded-lg">
                    <button
                      onClick={() =>
                        updateQuantity(item.variantId, item.quantity - 1)
                      }
                      className="px-2 py-1 hover:bg-gray-50 rounded-l-lg"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() =>
                        updateQuantity(item.variantId, item.quantity + 1)
                      }
                      disabled={item.quantity >= item.stock}
                      className="px-2 py-1 hover:bg-gray-50 rounded-r-lg disabled:opacity-40"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-5 py-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-xl font-bold">{formatPrice(getTotalPrice())}</span>
            </div>
            <p className="text-xs text-gray-400">Envío y descuentos calculados al finalizar</p>
            <Link href="/checkout" onClick={onClose} className="block">
              <Button size="lg" className="w-full">
                Ir al checkout
              </Button>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
