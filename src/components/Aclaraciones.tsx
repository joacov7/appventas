"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

interface Item { titulo: string; texto: string }

// Muestra las aclaraciones/condiciones (catálogo, portal, checkout).
// `compacto` = versión reducida para el checkout.
export function Aclaraciones({ titulo = "Aclaraciones importantes", compacto = false }: { titulo?: string; compacto?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch("/api/aclaraciones").then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => {});
  }, []);

  if (!items.length) return null;

  return (
    <section className={`rounded-2xl border border-gray-100 bg-white ${compacto ? "p-4" : "p-5 sm:p-6"}`}>
      <h2 className={`flex items-center gap-2 font-bold text-gray-900 ${compacto ? "text-sm" : "text-lg"} mb-3`}>
        <Info size={compacto ? 15 : 18} className="text-emerald-600" /> {titulo}
      </h2>
      <div className={`grid ${compacto ? "grid-cols-1 gap-2" : "sm:grid-cols-2 gap-x-6 gap-y-3"}`}>
        {items.map((it, i) => (
          <div key={i}>
            <p className={`font-semibold text-gray-800 ${compacto ? "text-xs" : "text-sm"}`}>{it.titulo}</p>
            <p className={`text-gray-500 ${compacto ? "text-xs" : "text-sm"} whitespace-pre-wrap`}>{it.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
