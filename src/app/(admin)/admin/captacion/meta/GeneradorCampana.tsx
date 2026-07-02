"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Check } from "lucide-react";

type Candidato = {
  id: string;
  nombre: string;
  imagen: string | null;
  precio: number;
  margen_pct: number | null;
  ventas_30d: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

export function GeneradorCampana({ onCreada }: { onCreada?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [estrategia, setEstrategia] = useState<"ventas" | "rotacion">("ventas");
  const [candidatos, setCandidatos] = useState<{ ventas: Candidato[]; rotacion: Candidato[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!abierto || candidatos) return;
    setLoading(true);
    fetch("/api/empleado/campana")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setCandidatos(d); })
      .finally(() => setLoading(false));
  }, [abierto, candidatos]);

  async function generar(c: Candidato) {
    setGenerando(c.id); setMsg("");
    try {
      const r = await fetch("/api/empleado/campana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: c.id, estrategia }),
      });
      const data = await r.json();
      if (!r.ok) { setMsg(data.error ?? "Error al generar"); return; }
      setMsg(`✓ Borrador "${data.nombre}" creado con ${data.anuncios} anuncios.${data.razon_publico ? ` Público: ${data.razon_publico}` : ""} Revisalo en la pestaña Campañas.`);
      onCreada?.();
    } catch {
      setMsg("Error de conexión");
    } finally { setGenerando(null); }
  }

  const lista = candidatos ? (estrategia === "ventas" ? candidatos.ventas : candidatos.rotacion) : [];

  return (
    <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100 shadow-sm">
      <button onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center justify-between p-4 text-left">
        <span className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles size={17} className="text-purple-600" />
          Generar campaña con IA
          <span className="text-xs font-normal text-gray-400">— el empleado virtual arma el borrador completo</span>
        </span>
        {abierto ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {abierto && (
        <div className="px-4 pb-4">
          <div className="flex gap-2 mb-3">
            <button onClick={() => setEstrategia("ventas")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${estrategia === "ventas" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Escalar lo que vende
            </button>
            <button onClick={() => setEstrategia("rotacion")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${estrategia === "rotacion" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Destrabar sin rotación
            </button>
          </div>

          {msg && (
            <p className={`text-sm mb-3 ${msg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{msg}</p>
          )}

          {loading ? (
            <p className="text-sm text-gray-400 flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Analizando catálogo...</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-gray-400">
              {estrategia === "ventas"
                ? "No hay productos con precio activo para sugerir."
                : "No hay productos frenados: todo tu catálogo tuvo ventas en los últimos 30 días 🎉"}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lista.map((c) => (
                <div key={c.id} className="flex items-center gap-3 bg-white border rounded-xl p-2.5">
                  {c.imagen && <img src={c.imagen} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {fmt(c.precio)}
                      {c.margen_pct != null && ` · margen ${c.margen_pct.toFixed(0)}%`}
                      {` · ${c.ventas_30d} venta${c.ventas_30d !== 1 ? "s" : ""}/30d`}
                    </p>
                  </div>
                  <button onClick={() => generar(c)} disabled={generando !== null}
                    className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-full shrink-0">
                    {generando === c.id ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                    {generando === c.id ? "Generando..." : "Generar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
