"use client";

import { useState } from "react";
import { Trophy, Search, Star, Flame, ExternalLink, TrendingUp } from "lucide-react";

interface Ganador {
  nombre: string; precio: number; url: string; imagen: string | null;
  vendidos: number | null; reviews: number | null; rating: number | null;
  mas_vendido: boolean; score: number;
}
interface Resumen {
  termino: string; total: number;
  precio_min: number | null; precio_prom: number | null; precio_max: number | null;
  ganadores: Ganador[];
}

const money = (n: number | null) => n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

export function GanadoresTab() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar() {
    if (!q.trim()) return;
    setLoading(true); setError(null); setData(null);
    try {
      const r = await fetch(`/api/inteligencia/research?q=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      if (r.ok) setData(d);
      else setError(d.error ?? "No se pudo buscar");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Buscá un rubro o producto en MercadoLibre y mirá qué se vende más, a qué precio. Ranking por ventas y reseñas.
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && buscar()}
            placeholder="Ej: mate imperial, termo stanley, bombilla alpaca..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border rounded-xl outline-none" />
        </div>
        <button onClick={buscar} disabled={loading || !q.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 rounded-xl">
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Analizando MercadoLibre… (puede tardar unos segundos)</p>}
      {error && <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Productos" val={String(data.total)} />
            <Stat label="Precio mín." val={money(data.precio_min)} />
            <Stat label="Precio prom." val={money(data.precio_prom)} />
            <Stat label="Precio máx." val={money(data.precio_max)} />
          </div>

          <div className="space-y-2">
            {data.ganadores.map((g, i) => (
              <div key={g.url} className="bg-white rounded-xl border p-3 flex items-center gap-3">
                <div className="w-7 text-center shrink-0">
                  <span className={`text-sm font-bold ${i < 3 ? "text-amber-500" : "text-gray-300"}`}>{i + 1}</span>
                </div>
                {g.imagen
                  ? <img src={g.imagen} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border" />
                  : <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-gray-800 truncate max-w-[22rem]">{g.nombre}</p>
                    {g.mas_vendido && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Flame size={10} /> Más vendido</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-400">
                    <span className="text-gray-700 font-medium">{money(g.precio)}</span>
                    {g.vendidos != null && <span className="flex items-center gap-0.5 text-emerald-600"><TrendingUp size={11} /> {g.vendidos}+ vendidos</span>}
                    {g.rating != null && <span className="flex items-center gap-0.5"><Star size={11} className="text-amber-400" /> {g.rating}{g.reviews != null ? ` (${g.reviews})` : ""}</span>}
                  </div>
                </div>
                <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-indigo-600 shrink-0"><ExternalLink size={15} /></a>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Trophy size={12} /> Ordenado por “ganador”: ventas + reseñas + badge de más vendido. Los datos dependen de lo que ML publica en el listado.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, val }: { label: string; val: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-lg font-bold text-gray-900">{val}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
