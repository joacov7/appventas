"use client";

import { useEffect, useState } from "react";
import { CalendarDays, RefreshCw, Megaphone, Flame, Check, ChevronRight } from "lucide-react";

interface Fecha {
  nombre: string; fecha: string; dias_restantes: number;
  relevancia: "alta" | "media"; angulo: string;
}
interface Candidato {
  id: string; nombre: string; precio: number; margen_pct: number | null; ventas_30d: number;
}

function fmtFecha(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long" });
}

export default function MarketingPage() {
  const [fechas, setFechas] = useState<Fecha[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [genPara, setGenPara] = useState<Fecha | null>(null);
  const [productoSel, setProductoSel] = useState<string>("");
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [f, c] = await Promise.all([
      fetch("/api/marketing/calendario?ventana=150").then(r => r.ok ? r.json() : []),
      fetch("/api/empleado/campana").then(r => r.ok ? r.json() : {}),
    ]);
    setFechas(Array.isArray(f) ? f : []);
    // El endpoint devuelve { ventas, rotacion }: los unimos sin repetir.
    const cc = c as any;
    const lista = Array.isArray(cc) ? cc : [...(cc?.ventas ?? []), ...(cc?.rotacion ?? [])];
    const vistos = new Set<string>();
    setCandidatos(lista.filter((x: Candidato) => x && !vistos.has(x.id) && vistos.add(x.id)));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function abrirGenerar(f: Fecha) {
    setGenPara(f); setResultado(null);
    setProductoSel(candidatos[0]?.id ?? "");
  }

  async function generar() {
    if (!genPara || !productoSel) return;
    setGenerando(true); setResultado(null);
    const r = await fetch("/api/empleado/campana", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: productoSel, ocasion: genPara.nombre, estrategia: "ventas" }),
    });
    setGenerando(false);
    const data = await r.json();
    if (r.ok && data.ok) setResultado("ok");
    else setResultado(data.error ?? "No se pudo generar la campaña");
  }

  const proxima = fechas[0];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Marketing / Calendario</h1>
            <p className="text-sm text-gray-500">Fechas comerciales con anticipación y generación de campañas.</p>
          </div>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {/* Próxima fecha destacada */}
      {proxima && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-2xl p-5">
          <p className="text-xs opacity-80">Próxima fecha comercial</p>
          <div className="flex items-end justify-between gap-3 mt-1">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {proxima.relevancia === "alta" && <Flame size={20} />}{proxima.nombre}
              </h2>
              <p className="text-sm opacity-90 mt-1">{proxima.angulo}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-bold">{proxima.dias_restantes}</p>
              <p className="text-xs opacity-80">días ({fmtFecha(proxima.fecha)})</p>
            </div>
          </div>
          <button onClick={() => abrirGenerar(proxima)}
            className="mt-4 flex items-center gap-1.5 bg-white text-indigo-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-50">
            <Megaphone size={15} /> Generar campaña para {proxima.nombre}
          </button>
        </div>
      )}

      {/* Timeline de fechas */}
      {loading ? (
        <p className="text-gray-400 text-sm">Cargando calendario...</p>
      ) : (
        <div className="space-y-2">
          {fechas.map(f => (
            <div key={f.nombre + f.fecha} className="bg-white rounded-xl border p-4 flex items-center gap-4">
              <div className="text-center shrink-0 w-14">
                <p className={`text-xl font-bold ${f.relevancia === "alta" ? "text-indigo-600" : "text-gray-700"}`}>{f.dias_restantes}</p>
                <p className="text-[10px] text-gray-400">días</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 text-sm">{f.nombre}</h3>
                  {f.relevancia === "alta" && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Fuerte</span>}
                  <span className="text-xs text-gray-400">{fmtFecha(f.fecha)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{f.angulo}</p>
              </div>
              <button onClick={() => abrirGenerar(f)}
                className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg shrink-0" title="Generar campaña">
                <Megaphone size={16} />
              </button>
            </div>
          ))}
          {fechas.length === 0 && <p className="text-gray-400 text-sm">No hay fechas comerciales en la ventana.</p>}
        </div>
      )}

      {/* Modal generar campaña */}
      {genPara && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setGenPara(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b">
              <h2 className="font-semibold text-gray-900">Campaña para {genPara.nombre}</h2>
              <p className="text-xs text-gray-500 mt-1">En {genPara.dias_restantes} días · {genPara.angulo}</p>
            </div>
            <div className="p-5 space-y-3">
              {resultado === "ok" ? (
                <div className="text-center py-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3"><Check size={24} /></div>
                  <p className="text-sm text-gray-700">Borrador de campaña generado.</p>
                  <a href="/admin/captacion/meta" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1 mt-2">
                    Ver en Meta Ads <ChevronRight size={14} />
                  </a>
                </div>
              ) : (
                <>
                  <label className="text-xs text-gray-500">Producto a promocionar</label>
                  <select value={productoSel} onChange={e => setProductoSel(e.target.value)}
                    className="w-full text-sm border rounded-lg px-3 py-2 outline-none bg-white">
                    {candidatos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.margen_pct != null ? ` · margen ${Math.round(c.margen_pct)}%` : ""}{c.ventas_30d ? ` · ${c.ventas_30d} vtas 30d` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400">La IA solo redacta los textos del anuncio. El resto es automático.</p>
                  {resultado && resultado !== "ok" && <p className="text-sm text-red-500">{resultado}</p>}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <button onClick={() => setGenPara(null)} className="text-sm text-gray-500 px-4 py-2">
                {resultado === "ok" ? "Cerrar" : "Cancelar"}
              </button>
              {resultado !== "ok" && (
                <button onClick={generar} disabled={generando || !productoSel}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
                  <Megaphone size={15} /> {generando ? "Generando..." : "Generar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
