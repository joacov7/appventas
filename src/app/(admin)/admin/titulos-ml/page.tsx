"use client";

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { ProductoPickerML } from "@/components/admin/ProductoPickerML";

export default function TitulosMLPage() {
  const [nombre, setNombre] = useState("");
  const [detalles, setDetalles] = useState("");
  const [titulos, setTitulos] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState<number | null>(null);

  async function generar() {
    if (!nombre.trim()) { setError("Poné el nombre del producto"); return; }
    setCargando(true); setError(""); setTitulos([]);
    const r = await fetch("/api/ml/titulos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, detalles }),
    });
    setCargando(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok) setTitulos(d.titulos ?? []);
    else setError(d.error ?? "No se pudo generar");
  }

  function copiar(t: string, i: number) {
    navigator.clipboard.writeText(t);
    setCopiado(i);
    setTimeout(() => setCopiado(null), 1500);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Sparkles className="text-yellow-500" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Títulos ganadores para ML</h1>
          <p className="text-sm text-gray-500">Generá títulos optimizados para Mercado Libre (máx. 60 caracteres).</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div>
          <label className="text-xs text-gray-500">Traer del catálogo (opcional)</label>
          <div className="mt-1"><ProductoPickerML onSelect={p => setNombre(p.name)} /></div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Producto</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Mate imperial de calabaza forrado en cuero"
            className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-300" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Datos extra (opcional)</label>
          <textarea value={detalles} onChange={e => setDetalles(e.target.value)} rows={2}
            placeholder="Marca, material, medidas, color, capacidad, para regalo, etc."
            className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-300 resize-y" />
        </div>
        <button onClick={generar} disabled={cargando}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-gray-900 text-sm font-semibold px-4 py-2 rounded-xl">
          <Sparkles size={16} /> {cargando ? "Generando..." : "Generar títulos"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {titulos.length > 0 && (
        <div className="space-y-2">
          {titulos.map((t, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{t}</p>
                <p className={`text-[11px] ${t.length > 60 ? "text-red-500" : "text-gray-400"}`}>{t.length}/60 caracteres</p>
              </div>
              <button onClick={() => copiar(t, i)} className="shrink-0 text-gray-400 hover:text-yellow-600" title="Copiar">
                {copiado === i ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
