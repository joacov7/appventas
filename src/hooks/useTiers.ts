"use client";

import { useEffect, useState } from "react";

export interface PriceTier {
  id: number;
  tipo: "cantidad" | "monto";
  min_qty: number | null;
  min_monto: number | null;
  descuento_pct: number;
  etiqueta: string;
}

let cache: PriceTier[] | null = null;
let fetchPromise: Promise<PriceTier[]> | null = null;

function fetchTiers(): Promise<PriceTier[]> {
  if (cache) return Promise.resolve(cache);
  if (!fetchPromise) {
    fetchPromise = fetch("/api/mayorista/tiers")
      .then((r) => r.json())
      .then((data: any[]) => {
        // Normalize: tiers without tipo field default to "cantidad" (backwards compat)
        const normalized = data.map((t) => ({ ...t, tipo: t.tipo ?? "cantidad" }));
        cache = normalized;
        return normalized;
      })
      .catch(() => []);
  }
  return fetchPromise;
}

export function useTiers() {
  const [tiers, setTiers] = useState<PriceTier[]>(cache ?? []);
  useEffect(() => { fetchTiers().then(setTiers); }, []);
  return tiers;
}

/** For "cantidad" tiers: find applicable tier by unit quantity */
export function getTierForQty(tiers: PriceTier[], qty: number): PriceTier | null {
  const applicable = tiers
    .filter((t) => t.tipo === "cantidad" && t.min_qty != null && qty >= t.min_qty)
    .sort((a, b) => (b.min_qty ?? 0) - (a.min_qty ?? 0));
  return applicable[0] ?? null;
}

/** For "monto" tiers: find applicable tier by total line amount (qty * price) */
export function getTierForAmount(tiers: PriceTier[], totalAmount: number): PriceTier | null {
  const applicable = tiers
    .filter((t) => t.tipo === "monto" && t.min_monto != null && totalAmount >= t.min_monto)
    .sort((a, b) => (b.min_monto ?? 0) - (a.min_monto ?? 0));
  return applicable[0] ?? null;
}

/** Unified: pick best tier regardless of type */
export function getBestTier(tiers: PriceTier[], qty: number, price: number): PriceTier | null {
  const byQty = getTierForQty(tiers, qty);
  const byAmount = getTierForAmount(tiers, qty * price);
  if (!byQty && !byAmount) return null;
  if (!byQty) return byAmount;
  if (!byAmount) return byQty;
  return byQty.descuento_pct >= byAmount.descuento_pct ? byQty : byAmount;
}

export function applyTier(price: number, tier: PriceTier | null): number {
  if (!tier) return price;
  return price * (1 - tier.descuento_pct / 100);
}
