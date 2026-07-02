"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import type { CartItem } from "@/types/cart";

interface Suggestion {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  variantId: string;
  variantName: string;
  price: number;
  stock: number;
}

interface Props {
  cartItems: CartItem[];
}

export function CartUpsell({ cartItems }: Props) {
  const { addItem } = useCartStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (cartItems.length === 0) {
      setSuggestions([]);
      return;
    }

    const productIds = [...new Set(cartItems.map((i) => i.productId))];
    // Use the categoryId from first cart item if available — we don't store it in cart,
    // so we just pass excluded product IDs and let the API pick complementary items.
    const params = new URLSearchParams({ exclude: productIds.join(","), limit: "3" });

    fetch(`/api/productos/sugeridos?${params}`)
      .then((r) => r.json())
      .then((data: Suggestion[]) => setSuggestions(data.filter((s) => s.variantId && s.price)))
      .catch(() => {});
  }, [cartItems.length]); // re-fetch when cart size changes

  function handleAdd(s: Suggestion) {
    addItem({
      cartKey: s.variantId,
      variantId: s.variantId,
      productId: s.id,
      productName: s.name,
      variantName: s.variantName ?? s.name,
      price: s.price,
      quantity: 1,
      imageUrl: s.imageUrl,
      stock: s.stock,
      slug: s.slug,
    });
    setAdded((prev) => ({ ...prev, [s.variantId]: true }));
    setTimeout(() => setAdded((prev) => ({ ...prev, [s.variantId]: false })), 2000);
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="border-t pt-4 mt-2">
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles size={14} className="text-amber-500" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Completá tu kit</span>
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div key={s.variantId} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white shrink-0 border border-gray-100">
              <Image
                src={s.imageUrl ?? "/images/placeholder.png"}
                alt={s.name}
                fill className="object-cover" sizes="40px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 line-clamp-1">{s.name}</p>
              <p className="text-xs text-emerald-600 font-semibold">{formatPrice(s.price)}</p>
            </div>
            <button
              onClick={() => handleAdd(s)}
              disabled={added[s.variantId]}
              className="shrink-0 w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors disabled:bg-emerald-400"
              title="Agregar al carrito"
            >
              {added[s.variantId] ? (
                <span className="text-[10px] font-bold">✓</span>
              ) : (
                <Plus size={14} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
