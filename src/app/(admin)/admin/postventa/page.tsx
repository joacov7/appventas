"use client";

import { useEffect, useState } from "react";
import { Heart, RefreshCw, Star, RotateCcw, Copy, Mail } from "lucide-react";

interface Oportunidad {
  tipo: "resena" | "recompra";
  email: string; nombre: string; dias: number; compras: number; total_gastado: number;
  mensaje_sugerido: string;
}
interface Resumen { total: number; resenas: number; recompras: number; oportunidades: Oportunidad[] }

const money = (n: number) => "$" + Math.round(Number(n)).toLocaleString("es-AR");

export default function PostventaPage() {
  const [data, setData] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "resena" | "recompra">("todos");
  const [copiado, setCopiado] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/postventa");
    if (r.ok) setData(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function copiar(email: string, texto: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(email); setTimeout(() => setCopiado(null), 2000); } catch { /* noop */ }
  }

  const lista = (data?.oportunidades ?? []).filter(o => filtro === "todos" || o.tipo === filtro);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Postventa / Fidelización</h1>
            <p className="text-sm text-gray-500">Aprovechá a los que ya te compraron: reseñas y recompra.</p>
          </div>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <button onClick={() => setFiltro("todos")} className={`bg-white rounded-2xl border p-4 text-left ${filtro === "todos" ? "ring-2 ring-indigo-500" : ""}`}>
          <p className="text-2xl font-bold text-gray-900">{data?.total ?? 0}</p><p className="text-xs text-gray-500">Total</p>
        </button>
        <button onClick={() => setFiltro("resena")} className={`bg-white rounded-2xl border p-4 text-left ${filtro === "resena" ? "ring-2 ring-amber-400" : ""}`}>
          <p className="text-2xl font-bold text-amber-500">{data?.resenas ?? 0}</p><p className="text-xs text-gray-500">Pedir reseña</p>
        </button>
        <button onClick={() => setFiltro("recompra")} className={`bg-white rounded-2xl border p-4 text-left ${filtro === "recompra" ? "ring-2 ring-emerald-400" : ""}`}>
          <p className="text-2xl font-bold text-emerald-600">{data?.recompras ?? 0}</p><p className="text-xs text-gray-500">Reactivar</p>
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : lista.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Heart className="mx-auto text-gray-300 mb-3" size={32} />
          <p className="text-gray-500 text-sm">Sin oportunidades por ahora. Aparecen a medida que tengas ventas concretadas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(o => (
            <div key={o.email + o.tipo} className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${o.tipo === "resena" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {o.tipo === "resena" ? <><Star size={11} /> Reseña</> : <><RotateCcw size={11} /> Recompra</>}
                </span>
                <h3 className="font-semibold text-gray-900">{o.nombre}</h3>
                <span className="text-xs text-gray-400">{o.email}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-400">
                <span>{o.tipo === "resena" ? `compró hace ${o.dias} días` : `sin comprar hace ${o.dias} días`}</span>
                <span>{o.compras} compra{o.compras !== 1 ? "s" : ""}</span>
                <span>total {money(o.total_gastado)}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-3">{o.mensaje_sugerido}</p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => copiar(o.email, o.mensaje_sugerido)}
                  className="flex items-center gap-1.5 border text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg">
                  <Copy size={13} /> {copiado === o.email ? "Copiado ✓" : "Copiar"}
                </button>
                <a href={`mailto:${o.email}?subject=${encodeURIComponent(o.tipo === "resena" ? "¡Gracias por tu compra!" : "Te extrañamos 🧉")}&body=${encodeURIComponent(o.mensaje_sugerido)}`}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-lg">
                  <Mail size={13} /> Enviar email
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
