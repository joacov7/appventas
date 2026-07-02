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

/** Find applicable tier for a quantity (cantidad type) */
export function getTierForQty(tiers: PriceTier[], qty: number): PriceTier | null {
  const applicable = tiers
    .filter((t) => t.tipo === "cantidad" && t.min_qty != null && qty >= t.min_qty)
    .sort((a, b) => (b.min_qty ?? 0) - (a.min_qty ?? 0));
  return applicable[0] ?? null;
}

/** Find applicable tier for a total amount (monto type) */
export function getTierForAmount(tiers: PriceTier[], totalAmount: number): PriceTier | null {
  const applicable = tiers
    .filter((t) => t.tipo === "monto" && t.min_monto != null && totalAmount >= t.min_monto)
    .sort((a, b) => (b.min_monto ?? 0) - (a.min_monto ?? 0));
  return applicable[0] ?? null;
}

/** Cart-level: best tier based on total cart quantity + total cart amount */
export function getCartTier(tiers: PriceTier[], totalQty: number, totalMonto: number): PriceTier | null {
  const byQty = getTierForQty(tiers, totalQty);
  const byAmount = getTierForAmount(tiers, totalMonto);
  if (!byQty && !byAmount) return null;
  if (!byQty) return byAmount;
  if (!byAmount) return byQty;
  return byQty.descuento_pct >= byAmount.descuento_pct ? byQty : byAmount;
}

/** Next tier the cart hasn't reached yet, with how much is missing */
export function getNextCartTier(
  tiers: PriceTier[],
  totalQty: number,
  totalMonto: number,
): { tier: PriceTier; missingQty?: number; missingMonto?: number } | null {
  const qtyTiers = tiers
    .filter((t) => t.tipo === "cantidad")
    .sort((a, b) => (a.min_qty ?? 0) - (b.min_qty ?? 0));
  const montoTiers = tiers
    .filter((t) => t.tipo === "monto")
    .sort((a, b) => (a.min_monto ?? 0) - (b.min_monto ?? 0));
  const nextQty = qtyTiers.find((t) => (t.min_qty ?? 0) > totalQty);
  const nextMonto = montoTiers.find((t) => (t.min_monto ?? 0) > totalMonto);
  if (!nextQty && !nextMonto) return null;
  if (nextQty && !nextMonto) return { tier: nextQty, missingQty: (nextQty.min_qty ?? 0) - totalQty };
  if (!nextQty && nextMonto) return { tier: nextMonto, missingMonto: (nextMonto.min_monto ?? 0) - totalMonto };
  return nextQty!.descuento_pct >= nextMonto!.descuento_pct
    ? { tier: nextQty!, missingQty: (nextQty!.min_qty ?? 0) - totalQty }
    : { tier: nextMonto!, missingMonto: (nextMonto!.min_monto ?? 0) - totalMonto };
}

/** Single-product compat wrapper */
export function getBestTier(tiers: PriceTier[], qty: number, price: number): PriceTier | null {
  return getCartTier(tiers, qty, qty * price);
}

export function applyTier(price: number, tier: PriceTier | null): number {
  if (!tier) return price;
  return price * (1 - tier.descuento_pct / 100);
}
