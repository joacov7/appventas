"use client";

import { useState, useRef } from "react";
import { X, ShoppingBag, Trash2, Plus, Minus, Tag, CheckCircle, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import Image from "next/image";
import Link from "next/link";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface CouponResult {
  id: string;
  code: string;
  type: string;
  value: number;
  discount: number;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, getTotalPrice, getTotalItems } = useCartStore();

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const [cartEmail, setCartEmail] = useState("");
  const [cartEmailSaved, setCartEmailSaved] = useState(false);
  const cartEmailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subtotal = getTotalPrice();
  const discount = coupon?.discount ?? 0;
  const total = subtotal - discount;

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await fetch("/api/cupones/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error);
        setCoupon(null);
      } else {
        setCoupon(data);
      }
    } catch {
      setCouponError("Error al validar");
    } finally {
      setCouponLoading(false);
    }
  }

  function handleCartEmailChange(email: string) {
    setCartEmail(email);
    setCartEmailSaved(false);
    if (cartEmailTimerRef.current) clearTimeout(cartEmailTimerRef.current);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    cartEmailTimerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/carritos-abandonados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmed,
            items: items.map((i) => ({
              productName: i.productName,
              variantName: i.diseno ? `Virola personalizada · ${i.diseno.virolaName}` : i.variantName,
              quantity: i.quantity,
              price: i.price,
              imageUrl: i.diseno?.preview ?? i.imageUrl ?? null,
            })),
            total: getTotalPrice(),
          }),
        });
        setCartEmailSaved(true);
      } catch {}
    }, 800);
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponCode("");
    setCouponError("");
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      )}

      <aside className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}>
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
              <Button variant="ghost" size="sm" onClick={onClose}>Seguir comprando</Button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.cartKey} className="flex gap-3 items-start">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                  <Image
                    src={item.diseno?.preview ?? item.imageUrl ?? "/images/placeholder.png"}
                    alt={item.productName}
                    fill className="object-cover" sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 line-clamp-1">{item.productName}</p>
                  <p className="text-xs text-gray-500">
                    {item.diseno ? `Virola personalizada · ${item.diseno.virolaName}` : item.variantName}
                  </p>
                  <p className="text-sm font-semibold text-emerald-700 mt-1">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button onClick={() => removeItem(item.cartKey)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                  <div className="flex items-center gap-1.5 border rounded-lg">
                    <button onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                      className="px-2 py-1 hover:bg-gray-50 rounded-l-lg">
                      <Minus size={12} />
                    </button>
                    <span className="text-sm w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="px-2 py-1 hover:bg-gray-50 rounded-r-lg disabled:opacity-40">
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
            {/* Cupón de descuento */}
            {coupon ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">{coupon.code}</span>
                  <span className="text-sm">— {formatPrice(coupon.discount)} off</span>
                </div>
                <button onClick={removeCoupon} className="text-emerald-500 hover:text-emerald-700">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-3 gap-2">
                    <Tag size={14} className="text-gray-400" />
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                      placeholder="Código de descuento"
                      className="flex-1 py-2 text-sm text-gray-900 outline-none bg-transparent"
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={applyCoupon} loading={couponLoading}>
                    Aplicar
                  </Button>
                </div>
                {couponError && <p className="text-xs text-red-500 pl-1">{couponError}</p>}
              </div>
            )}

            {/* Totales */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Descuento</span>
                  <span>− {formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Captura de email para carrito abandonado */}
            <div className="space-y-1">
              <div className="flex items-center border border-gray-200 rounded-xl px-3 gap-2">
                <Mail size={14} className="text-gray-400 shrink-0" />
                <input
                  type="email"
                  value={cartEmail}
                  onChange={(e) => handleCartEmailChange(e.target.value)}
                  placeholder="Tu email para guardar el carrito"
                  className="flex-1 py-2 text-sm text-gray-900 outline-none bg-transparent"
                />
                {cartEmailSaved && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
              </div>
            </div>

            {/* Métodos de pago */}
            <div className="flex items-center gap-2 justify-center">
              <span className="text-xs text-gray-400">Pagás con</span>
              {["Visa", "Master", "Amex", "MP"].map((m) => (
                <span key={m} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{m}</span>
              ))}
            </div>

            <Link href={`/checkout${coupon ? `?cupon=${coupon.code}` : ""}`} onClick={onClose} className="block">
              <Button size="lg" className="w-full">Ir al checkout</Button>
            </Link>

            {/* Compartir carrito por WhatsApp */}
            {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
              <CartWhatsAppButton items={items} total={total} onClose={onClose} />
            )}
          </div>
        )}
      </aside>
    </>
  );
}

// ── Botón de carrito por WhatsApp ────────────────────────────────────────────
import type { CartItem } from "@/types/cart";

function CartWhatsAppButton({ items, total, onClose }: { items: CartItem[]; total: number; onClose: () => void }) {
  const num = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  if (!num) return null;

  function buildMessage() {
    const lines = items.map((i) =>
      i.diseno
        ? `• ${i.productName} (personalizada) x${i.quantity} — ${formatPrice(i.price * i.quantity)}`
        : `• ${i.productName} — ${i.variantName} x${i.quantity} — ${formatPrice(i.price * i.quantity)}`
    );
    return [
      "Hola! Quiero hacer el siguiente pedido:",
      "",
      ...lines,
      "",
      `*Total: ${formatPrice(total)}*`,
      "",
      "¿Pueden confirmar disponibilidad?",
    ].join("\n");
  }

  return (
    <a
      href={`https://wa.me/${num}?text=${encodeURIComponent(buildMessage())}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClose}
      className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-medium text-sm py-3 rounded-xl transition-colors w-full"
    >
      <MessageCircle size={17} fill="white" strokeWidth={0} />
      Pedir por WhatsApp
    </a>
  );
}
