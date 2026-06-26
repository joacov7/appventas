"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, CartState } from "@/types/cart";

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => {
        const cartKey = newItem.cartKey ?? newItem.variantId;
        set((state) => {
          // Design items always add as new entries; regular items merge by variantId
          if (!newItem.diseno) {
            const existing = state.items.find((i) => i.cartKey === cartKey);
            if (existing) {
              const nextQty = existing.quantity + (newItem.quantity ?? 1);
              return {
                items: state.items.map((i) =>
                  i.cartKey === cartKey
                    ? { ...i, quantity: Math.min(nextQty, i.stock) }
                    : i
                ),
              };
            }
          }
          return {
            items: [
              ...state.items,
              { ...newItem, cartKey, quantity: newItem.quantity ?? 1 },
            ],
          };
        });
      },

      removeItem: (cartKey) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartKey !== cartKey),
        })),

      updateQuantity: (cartKey, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.cartKey === cartKey
              ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
              : i
          ),
        })),

      clearCart: () => set({ items: [] }),

      getTotalItems: () =>
        get().items.reduce((acc, i) => acc + i.quantity, 0),

      getTotalPrice: () =>
        get().items.reduce((acc, i) => acc + i.price * i.quantity, 0),
    }),
    {
      name: "appventas-cart",
    }
  )
);
