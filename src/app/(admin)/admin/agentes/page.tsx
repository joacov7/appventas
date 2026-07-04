"use client";

import { useEffect, useState } from "react";
import { Bot, Play, RefreshCw, Clock, Wrench, Brain, DollarSign, ChevronDown, ChevronUp, Zap } from "lucide-react";

type Run = {
  fecha: string; ok: boolean; ms: number; costUsd: number | null;
  decision: any; telemetry: any;
};
type Agente = {
  id: string; nombre: string; rol: string; objetivo: string; categoria: string;
  tools: string[]; enabled: boolean; autonomy: string; ultimaEjecucion: Run | null;
};

const AUTONOMIA: Record<string, { label: string; desc: string; color: string }> = {
  manual:     { label: "Manual", desc: "Solo recomienda", color: "bg-gray-100 text-gray-600" },
  assisted:   { label: "Asistido", desc: "Propone acciones para aprobar", color: "bg-amber-100 text-amber-700" },
  autonomous: { label: "Autónomo", desc: "Ejecuta lo permitido", color: "bg-emerald-100 text-emerald-700" },
};

function fmtFecha(s: string) {
  return new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AgentesPage() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/agentes");
    if (r.ok) setAgentes((await r.json()).agentes ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function ejecutar(id: string) {
    setCorriendo(id);
    try {
      await fetch("/api/agentes/run", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: id }),
      });
      setExpandido(id);
      await load();
    } finally { setCorriendo(null); }
  }

  async function cambiar(id: string, campo: "enabled" | "autonomy", valor: any) {
    const a = agentes.find(x => x.id === id)!;
    const body = { agentId: id, enabled: campo === "enabled" ? valor : a.enabled, autonomy: campo === "autonomy" ? valor : a.autonomy };
    setAgentes(prev => prev.map(x => x.id === id ? { ...x, [campo]: valor } : x));
    await fetch("/api/agentes/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <Bot className="text-indigo-600" size={24} />
        <h1 className="text-xl font-bold text-gray-900">Centro de Agentes</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Tus empleados digitales. Cada uno sigue el flujo: memoria → reglas → datos → IA (último recurso) → guarda la experiencia.
      </p>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-4">
          {agentes.map(a => {
            const run = a.ultimaEjecucion;
            const t = run?.telemetry;
            const abierto = expandido === a.id;
            return (
              <div key={a.id} className={`bg-white rounded-2xl border shadow-sm ${!a.enabled ? "opacity-60" : ""}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{a.nombre}</h3>
                        <span className="text-xs text-gray-400">· {a.rol}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AUTONOMIA[a.autonomy]?.color}`}>
                          {AUTONOMIA[a.autonomy]?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{a.objetivo}</p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {a.tools.map(tool => (
                          <span key={tool} className="text-xs bg-gray-50 border text-gray-500 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Wrench size={9} /> {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => ejecutar(a.id)} disabled={corriendo !== null || !a.enabled}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl shrink-0">
                      {corriendo === a.id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                      {corriendo === a.id ? "Ejecutando..." : "Ejecutar"}
                    </button>
                  </div>

                  {/* Controles */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={a.enabled} onChange={e => cambiar(a.id, "enabled", e.target.checked)}
                        className="w-4 h-4 accent-emerald-600" />
                      {a.enabled ? "Activo" : "Inactivo"}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Autonomía:</span>
                      <select value={a.autonomy} onChange={e => cambiar(a.id, "autonomy", e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1 outline-none bg-white">
                        {Object.entries(AUTONOMIA).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.desc}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Última ejecución */}
                  {run && (
                    <div className="mt-3">
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1"><Clock size={11} /> {fmtFecha(run.fecha)}</span>
                        <span>{run.ms}ms</span>
                        {t && <span className="flex items-center gap-1"><Brain size={11} /> {t.memoriaConsultas} mem</span>}
                        {t && <span className="flex items-center gap-1"><Zap size={11} /> {t.llamadasIA} IA</span>}
                        <span className="flex items-center gap-1"><DollarSign size={11} /> {run.costUsd ? `$${run.costUsd.toFixed(5)}` : "$0 (sin IA)"}</span>
                        <button onClick={() => setExpandido(abierto ? null : a.id)}
                          className="ml-auto text-indigo-600 hover:underline flex items-center gap-0.5">
                          {abierto ? <>Ocultar <ChevronUp size={12} /></> : <>Ver resultado <ChevronDown size={12} /></>}
                        </button>
                      </div>

                      {abierto && (
                        <div className="mt-3 bg-gray-50 rounded-xl p-3">
                          {run.decision?.resumen && <p className="text-sm text-gray-800 mb-2">{run.decision.resumen}</p>}
                          {Array.isArray(run.decision?.recomendaciones) && run.decision.recomendaciones.length > 0 && (
                            <ul className="space-y-1.5 mb-3">
                              {run.decision.recomendaciones.map((rec: any, i: number) => (
                                <li key={i} className="text-sm">
                                  <span className="font-medium text-gray-900">{rec.titulo}</span>
                                  {rec.detalle && <span className="text-gray-500"> — {rec.detalle}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {t?.logs?.length > 0 && (
                            <details className="text-xs text-gray-400">
                              <summary className="cursor-pointer">Logs ({t.logs.length})</summary>
                              <pre className="mt-1 whitespace-pre-wrap font-mono">{t.logs.join("\n")}</pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
