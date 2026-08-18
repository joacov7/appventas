"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollText, RefreshCw, Play, Wrench, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

type Evento = {
  key: string;
  tipo: "ejecucion" | "accion";
  fecha: string;
  agentId: string | null;
  agente: string;
  // ejecucion
  ok?: boolean;
  ms?: number;
  costUsd?: number;
  tools?: string[];
  logs?: string[];
  resumen?: string | null;
  // accion
  tool?: string;
  input?: any;
  estado?: string;
  resueltoEn?: string | null;
};

type AgenteOpt = { id: string; nombre: string };

function fmt(s: string) {
  return new Date(s).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

const ESTADO_ACCION: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Esperando aprobación", cls: "bg-amber-100 text-amber-700" },
  ejecutada: { label: "Ejecutada", cls: "bg-emerald-100 text-emerald-700" },
  rechazada: { label: "Rechazada", cls: "bg-gray-100 text-gray-500" },
  error: { label: "Error", cls: "bg-red-100 text-red-700" },
};

export default function BitacoraPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [agentes, setAgentes] = useState<AgenteOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [agente, setAgente] = useState("");
  const [tipo, setTipo] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (agente) params.set("agente", agente);
    if (tipo) params.set("tipo", tipo);
    const r = await fetch(`/api/agentes/bitacora?${params.toString()}`);
    const d = await r.json();
    setEventos(d.eventos ?? []);
    if (d.agentes) setAgentes(d.agentes);
    setLoading(false);
  }, [agente, tipo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ScrollText size={22} className="text-emerald-600" />
          <h1 className="text-xl font-bold text-gray-900">Bitácora de agentes</h1>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Todo lo que hicieron los agentes, en una sola línea de tiempo: cuándo se
        ejecutaron y qué acciones propusieron, aprobaste o se rechazaron.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select value={agente} onChange={(e) => setAgente(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700">
          <option value="">Todos los agentes</option>
          {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700">
          <option value="">Todo</option>
          <option value="ejecucion">Solo ejecuciones</option>
          <option value="accion">Solo acciones</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-16 text-sm">Cargando…</div>
      ) : eventos.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <p className="mb-1 text-sm">Todavía no hay actividad de agentes.</p>
          <p className="text-xs">Cuando un agente se ejecute o proponga una acción, aparece acá.</p>
        </div>
      ) : (
        <ol className="relative border-l border-gray-200 ml-3 space-y-4">
          {eventos.map((ev) => (
            <li key={ev.key} className="ml-5">
              {/* Punto en la línea */}
              <span className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white ${
                ev.tipo === "ejecucion"
                  ? (ev.ok === false ? "bg-red-400" : "bg-emerald-400")
                  : "bg-amber-400"
              }`} />

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {ev.tipo === "ejecucion" ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Play size={12} /> Ejecución
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                      <Wrench size={12} /> Acción
                    </span>
                  )}
                  <span className="font-semibold text-gray-900 text-sm">{ev.agente}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={11} /> {fmt(ev.fecha)}
                  </span>
                </div>

                {/* Ejecución */}
                {ev.tipo === "ejecucion" && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                      {ev.ok === false ? (
                        <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> Falló</span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> OK</span>
                      )}
                      {typeof ev.ms === "number" && <span>· {ev.ms} ms</span>}
                      {!!ev.costUsd && <span>· ~${ev.costUsd.toFixed(4)}</span>}
                      {ev.tools && ev.tools.length > 0 && (
                        <span>· {ev.tools.length} herramienta{ev.tools.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    {ev.resumen && <p className="text-sm text-gray-700 mt-1.5">{ev.resumen}</p>}
                    {ev.logs && ev.logs.length > 0 && (
                      <button onClick={() => setAbierto(abierto === ev.key ? null : ev.key)}
                        className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                        {abierto === ev.key ? <>Ocultar detalle <ChevronUp size={12} /></> : <>Ver detalle ({ev.logs.length}) <ChevronDown size={12} /></>}
                      </button>
                    )}
                    {abierto === ev.key && ev.logs && (
                      <pre className="mt-2 bg-gray-50 rounded-xl p-3 text-[11px] text-gray-600 whitespace-pre-wrap font-mono overflow-x-auto">
                        {ev.logs.join("\n")}
                      </pre>
                    )}
                  </div>
                )}

                {/* Acción */}
                {ev.tipo === "accion" && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{ev.tool}</span>
                      {ev.estado && ESTADO_ACCION[ev.estado] && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ESTADO_ACCION[ev.estado].cls}`}>
                          {ESTADO_ACCION[ev.estado].label}
                        </span>
                      )}
                      {ev.resueltoEn && <span className="text-xs text-gray-400">· resuelta {fmt(ev.resueltoEn)}</span>}
                    </div>
                    {ev.input && typeof ev.input?.texto === "string" && (
                      <p className="text-sm text-gray-700 mt-1.5 line-clamp-3">{ev.input.texto}</p>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
