"use client";

import { useEffect, useState } from "react";

export interface PriceTier {
  id: number;
  min_qty: number;
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
      .then((data) => { cache = data; return data; })
      .catch(() => []);
  }
  return fetchPromise;
}

export function useTiers() {
  const [tiers, setTiers] = useState<PriceTier[]>(cache ?? []);

  useEffect(() => {
    fetchTiers().then(setTiers);
  }, []);

  return tiers;
}

export function getTierForQty(tiers: PriceTier[], qty: number): PriceTier | null {
  const applicable = tiers
    .filter((t) => qty >= t.min_qty)
    .sort((a, b) => b.min_qty - a.min_qty);
  return applicable[0] ?? null;
}

export function applyTier(price: number, tier: PriceTier | null): number {
  if (!tier) return price;
  return price * (1 - tier.descuento_pct / 100);
}
