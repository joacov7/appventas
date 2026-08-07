"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

// Barra de búsqueda + orden del catálogo. Escribe los parámetros en la URL
// (?search=&sort=) y deja que la página (server) haga la consulta.
export function CatalogoControls() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("search") ?? "");

  // Si cambia la URL por afuera (ej. clic en una categoría), sincronizamos el input.
  useEffect(() => { setQ(params.get("search") ?? ""); }, [params]);

  function aplicar(nuevo: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(nuevo)) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    sp.delete("page"); // cualquier cambio vuelve a la primera página
    router.push(`/productos?${sp.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <form
        onSubmit={(e) => { e.preventDefault(); aplicar({ search: q.trim() || null }); }}
        className="relative flex-1"
      >
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar (ej: termo, bombilla, mate imperial…)"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); aplicar({ search: null }); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Limpiar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </form>

      <select
        value={params.get("sort") ?? "destacados"}
        onChange={(e) => aplicar({ sort: e.target.value === "destacados" ? null : e.target.value })}
        className="rounded-xl border border-gray-200 text-sm px-3 py-2.5 bg-white focus:outline-none focus:border-emerald-400 sm:w-52"
      >
        <option value="destacados">Destacados primero</option>
        <option value="nuevos">Más nuevos</option>
        <option value="precio_asc">Precio: menor a mayor</option>
        <option value="precio_desc">Precio: mayor a menor</option>
        <option value="nombre">Nombre (A-Z)</option>
      </select>
    </div>
  );
}
