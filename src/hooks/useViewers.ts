"use client";

import { useEffect, useState } from "react";

// Genera un número "realista" seeded por el id del producto
function seededRandom(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  const norm = ((h >>> 0) % 1000) / 1000;
  return Math.floor(norm * (max - min + 1)) + min;
}

export function useViewers(productId: string) {
  const base = seededRandom(productId, 2, 11);
  const [viewers, setViewers] = useState(base);

  useEffect(() => {
    // Fluctuar ±1 cada 20-40 segundos para parecer real
    const interval = setInterval(() => {
      const delta = Math.random() < 0.5 ? -1 : 1;
      setViewers((v) => Math.max(1, Math.min(v + delta, base + 4)));
    }, 20000 + Math.random() * 20000);
    return () => clearInterval(interval);
  }, [base]);

  return viewers;
}
