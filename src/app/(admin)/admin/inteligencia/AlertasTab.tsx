"use client";

import { useEffect, useState } from "react";
import { Bell, TrendingUp, TrendingDown, ArrowDownCircle, RefreshCw, CheckCircle2 } from "lucide-react";

interface Alerta {
  product_id: string; producto: string; mi_precio: number | null;
  mercado_min: number | null; mercado_prom: number | null; competidores: number;
  tipo: "caro" | "barato" | "competencia_bajo" | "ok"; severidad: number;
  diferencia_pct: number | null; mensaje: string;
}
interface Resumen {
  productos_monitoreados: number; caros: number; baratos: number; competencia_bajo: number;
  alertas: Alerta[];
}

const money = (n: number | null) => n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

const ESTILO: Record<string, { color: string; Icon: any; label: string }> = {
  caro:             { color: "text-red-600 bg-red-50",       Icon: TrendingUp,      label: "Estás caro" },
  barato:           { color: "text-amber-600 bg-amber-50",   Icon: TrendingDown,    label: "Podés subir" },
  competencia_bajo: { color: "text-blue-600 bg-blue-50",     Icon: ArrowDownCircle, label: "Competidor bajó" },
  ok:               { color: "text-emerald-600 bg-emerald-50", Icon: CheckCircle2,  label: "En línea" },
};

export function AlertasTab() {
  const [data, setData] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [soloAccionables, setSoloAccionables] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/inteligencia/alertas");
    if (r.ok) setData(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const alertas = (data?.alertas ?? []).filter(a => soloAccionables ? a.tipo !== "ok" : true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Cruce automático de tu catálogo con la competencia vinculada. Sin IA.</p>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Monitoreados" val={data?.productos_monitoreados ?? 0} color="text-gray-900" />
        <Stat label="Caros" val={data?.caros ?? 0} color="text-red-600" />
        <Stat label="Podés subir" val={data?.baratos ?? 0} color="text-amber-600" />
        <Stat label="Competidor bajó" val={data?.competencia_bajo ?? 0} color="text-blue-600" />
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" checked={soloAccionables} onChange={e => setSoloAccionables(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
        Mostrar solo los que necesitan acción
      </label>

      {loading ? (
        <p className="text-gray-400 text-sm">Analizando...</p>
      ) : alertas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Bell className="mx-auto text-gray-300 mb-3" size={32} />
          <p className="text-gray-500 text-sm">
            {(data?.productos_monitoreados ?? 0) === 0
              ? "No hay productos vinculados a competencia todavía. Vinculá productos en la pestaña “Mi posición”."
              : "Todo bien: no hay alertas de precio."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map(a => {
            const st = ESTILO[a.tipo];
            return (
              <div key={a.product_id} className="bg-white rounded-xl border p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg ${st.color} shrink-0`}><st.Icon size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 text-sm truncate">{a.producto}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{a.mensaje}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-400">
                    <span>Tu precio: <b className="text-gray-700">{money(a.mi_precio)}</b></span>
                    <span>Mercado prom.: {money(a.mercado_prom)}</span>
                    <span>Mín.: {money(a.mercado_min)}</span>
                    <span>{a.competidores} competidores</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className={`text-2xl font-bold ${color}`}>{val}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
