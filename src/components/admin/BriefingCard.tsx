"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, ChevronRight } from "lucide-react";

type Accion = { titulo: string; detalle: string; modulo: string };
type Briefing = { fecha: string; resumen: string; acciones: Accion[]; creado_en: string };

const MODULO_HREF: Record<string, string> = {
  ordenes: "/admin/ordenes",
  productos: "/admin/productos",
  inteligencia: "/admin/inteligencia",
  captacion: "/admin/captacion",
  combos: "/admin/combos",
  marketing: "/admin/captacion/meta",
};

export function BriefingCard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  async function fetchBriefing() {
    setLoading(true);
    const r = await fetch("/api/briefing");
    if (r.ok) {
      const data = await r.json();
      if (data) {
        setBriefing({
          ...data,
          acciones: typeof data.acciones === "string" ? JSON.parse(data.acciones) : data.acciones,
        });
      }
    }
    setLoading(false);
  }

  useEffect(() => { fetchBriefing(); }, []);

  async function generar() {
    setGenerando(true); setError("");
    try {
      const r = await fetch("/api/briefing", { method: "POST" });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Error al generar"); return; }
      setBriefing({
        ...data,
        acciones: typeof data.acciones === "string" ? JSON.parse(data.acciones) : data.acciones,
      });
    } catch {
      setError("Error de conexión");
    } finally { setGenerando(false); }
  }

  const esDeHoy = briefing && new Date(briefing.creado_en).toDateString() === new Date().toDateString();

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-600" />
          Resumen del día
          {briefing && (
            <span className="text-xs font-normal text-gray-400">
              {new Date(briefing.creado_en).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </h2>
        <button onClick={generar} disabled={generando}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
          <RefreshCw size={13} className={generando ? "animate-spin" : ""} />
          {generando ? "Generando..." : esDeHoy ? "Regenerar" : "Generar ahora"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : !briefing ? (
        <p className="text-sm text-gray-500">
          Todavía no hay un resumen generado. Hacé clic en <span className="font-medium">Generar ahora</span> y tu empleado virtual analiza ventas, stock, competencia y leads.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{briefing.resumen}</p>
          {briefing.acciones?.length > 0 && (
            <div className="space-y-2">
              {briefing.acciones.map((a, i) => (
                <Link key={i} href={MODULO_HREF[a.modulo] ?? "/admin"}
                  className="flex items-start gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-indigo-200 hover:shadow-sm transition-all group">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{a.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.detalle}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 mt-1 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
