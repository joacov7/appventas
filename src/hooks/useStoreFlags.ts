"use client";

import { useEffect, useState } from "react";

// Flags públicos de la tienda, cacheados a nivel módulo para no refetchear en
// cada tarjeta de producto.
export interface StoreFlags {
  modoMayorista: boolean;
  pedidoMinimo: number;
  storeName: string;
}

let cache: StoreFlags | null = null;
let promesa: Promise<StoreFlags> | null = null;

function fetchFlags(): Promise<StoreFlags> {
  if (!promesa) {
    promesa = fetch("/api/store-config")
      .then(r => r.json())
      .then(d => {
        cache = {
          modoMayorista: d?.modoMayorista === true,
          pedidoMinimo: Number(d?.pedidoMinimo) || 0,
          storeName: d?.storeName || "",
        };
        return cache;
      })
      .catch(() => ({ modoMayorista: false, pedidoMinimo: 0, storeName: "" }));
  }
  return promesa;
}

export function useStoreFlags(): StoreFlags {
  const [flags, setFlags] = useState<StoreFlags>(cache ?? { modoMayorista: false, pedidoMinimo: 0, storeName: "" });
  useEffect(() => {
    if (cache) { setFlags(cache); return; }
    let vivo = true;
    fetchFlags().then(f => { if (vivo) setFlags(f); });
    return () => { vivo = false; };
  }, []);
  return flags;
}
