"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart2, ArrowLeft, RefreshCw } from "lucide-react";

interface Metricas {
  total: number;
  embudo: Record<string, number>;
  calidad: { A: number; B: number; C: number; con_telefono: number; con_email: number };
  tasa_contacto: number;
  tasa_interes: number;
  semanas: { semana: string; captados: number; contactos: number; interesados: number }[];
  top_zonas: { zona: string; total: number; contactados: number }[];
  top_rubros: { rubro: string; total: number }[];
}

const EMBUDO_ORDEN = ["nuevo", "contactado", "interesado", "descartado"] as const;
const EMBUDO_COLOR: Record<string, string> = {
  nuevo: "bg-blue-500", contactado: "bg-amber-400", interesado: "bg-emerald-500", descartado: "bg-gray-300",
};

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

export default function MetricasCaptacionPage() {
  const [m, setM] = useState<Metricas | null>(null);
  const [error, setError] = useState("");

  async function cargar() {
    setError("");
    const r = await fetch("/api/captacion/metricas");
    if (r.ok) setM(await r.json());
    else setError((await r.json()).error ?? "No se pudieron cargar las métricas");
  }
  useEffect(() => { cargar(); }, []);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!m) return <p className="text-sm text-gray-400">Cargando métricas...</p>;

  const maxSemana = Math.max(1, ...m.semanas.map(s => Math.max(s.captados, s.contactos, s.interesados)));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Métricas de captación</h1>
          <p className="text-sm text-gray-500">El embudo completo: captados → contactados → interesados.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={cargar} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
          <Link href="/admin/captacion" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={15} /> Captación
          </Link>
        </div>
      </div>

      {/* Tiles principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Prospectos", valor: m.total.toLocaleString("es-AR"), extra: "" },
          { label: "Con teléfono", valor: m.calidad.con_telefono.toLocaleString("es-AR"), extra: `${pct(m.calidad.con_telefono, m.total)}%` },
          { label: "Base trabajada", valor: `${m.tasa_contacto}%`, extra: "contactados o descartados" },
          { label: "Tasa de interés", valor: `${m.tasa_interes}%`, extra: "interesados / contactados" },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400">{t.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{t.valor}</p>
            {t.extra && <p className="text-[11px] text-gray-400 mt-0.5">{t.extra}</p>}
          </div>
        ))}
      </div>

      {/* Embudo por estado */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-medium text-gray-800 mb-3">Embudo por estado</p>
        <div className="space-y-2.5">
          {EMBUDO_ORDEN.map(e => {
            const n = m.embudo[e] ?? 0;
            return (
              <div key={e} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 capitalize shrink-0">{e}</span>
                <div className="flex-1 h-4 bg-gray-50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${EMBUDO_COLOR[e]}`} style={{ width: `${pct(n, m.total)}%`, minWidth: n ? 6 : 0 }} />
                </div>
                <span className="text-xs text-gray-600 w-20 text-right shrink-0">{n.toLocaleString("es-AR")} ({pct(n, m.total)}%)</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Calidad: <b className="text-emerald-600">{m.calidad.A} A</b> · <b className="text-amber-500">{m.calidad.B} B</b> · {m.calidad.C} C
          &nbsp;·&nbsp; {m.calidad.con_email} con email
        </p>
      </div>

      {/* Actividad semanal */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-medium text-gray-800 mb-1">Actividad semanal (últimas 8 semanas)</p>
        <p className="text-xs text-gray-400 mb-4">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-400 mr-1" />Captados
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 ml-3 mr-1" />Contactos
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 ml-3 mr-1" />Interesados
        </p>
        {m.semanas.length === 0 ? (
          <p className="text-sm text-gray-400">Sin actividad todavía. Buscá prospectos y empezá a contactar.</p>
        ) : (
          <div className="flex items-end gap-3 h-32 overflow-x-auto pb-1">
            {m.semanas.map(s => (
              <div key={s.semana} className="flex flex-col items-center gap-1 shrink-0">
                <div className="flex items-end gap-0.5 h-24">
                  {[
                    { v: s.captados, c: "bg-blue-400" },
                    { v: s.contactos, c: "bg-amber-400" },
                    { v: s.interesados, c: "bg-emerald-500" },
                  ].map((b, i) => (
                    <div key={i} title={String(b.v)} className={`w-4 rounded-t ${b.c}`}
                      style={{ height: `${Math.max((b.v / maxSemana) * 100, b.v ? 4 : 0)}%` }} />
                  ))}
                </div>
                <span className="text-[10px] text-gray-400">{s.semana}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top zonas y rubros */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-800 mb-3">Zonas con más prospectos</p>
          {m.top_zonas.length === 0 ? <p className="text-sm text-gray-400">Sin datos.</p> : (
            <div className="space-y-2">
              {m.top_zonas.map(z => (
                <div key={z.zona} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{z.zona}</span>
                  <span className="text-gray-500 text-xs shrink-0">{z.total.toLocaleString("es-AR")} · {pct(z.contactados, z.total)}% contactado</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-800 mb-3">Rubros más captados</p>
          {m.top_rubros.length === 0 ? <p className="text-sm text-gray-400">Sin datos.</p> : (
            <div className="space-y-2">
              {m.top_rubros.map(r => (
                <div key={r.rubro} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{r.rubro}</span>
                  <span className="text-gray-500 text-xs shrink-0">{r.total.toLocaleString("es-AR")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
