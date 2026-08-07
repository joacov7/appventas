"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export interface ProdElegido { id: string; name: string; costo: number }

// Buscador de productos del catálogo. Al elegir uno, devuelve su nombre y un
// costo sugerido (el costo cargado, o el menor precio de variante como respaldo).
export function ProductoPickerML({ onSelect, placeholder = "Buscar producto del catálogo…" }: {
  onSelect: (p: ProdElegido) => void; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [costos, setCostos] = useState<Record<string, number | null>>({});
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/productos/costos").then(r => r.json()).then(d => setCostos(d ?? {})).catch(() => {});
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/productos?search=${encodeURIComponent(q.trim())}`);
      const d = await r.json().catch(() => []);
      setResultados(Array.isArray(d) ? d.slice(0, 8) : []);
      setAbierto(true);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function fuera(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAbierto(false); }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  function elegir(p: any) {
    const minPrice = p.variants?.length ? Math.min(...p.variants.map((v: any) => Number(v.price) || 0)) : 0;
    const costo = costos[p.id] ?? minPrice;
    onSelect({ id: p.id, name: p.name, costo: Math.round(costo) });
    setQ(p.name); setAbierto(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => resultados.length && setAbierto(true)}
          placeholder={placeholder}
          className="w-full text-sm border rounded-lg pl-9 pr-8 py-2 outline-none focus:ring-2 focus:ring-yellow-300" />
        {q && <button onClick={() => { setQ(""); setResultados([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={15} /></button>}
      </div>
      {abierto && resultados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {resultados.map(p => {
            const minPrice = p.variants?.length ? Math.min(...p.variants.map((v: any) => Number(v.price) || 0)) : 0;
            return (
              <button key={p.id} onClick={() => elegir(p)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 border-b last:border-0">
                <span className="text-gray-800">{p.name}</span>
                <span className="text-xs text-gray-400 ml-2">{minPrice ? `$${minPrice.toLocaleString("es-AR")}` : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
