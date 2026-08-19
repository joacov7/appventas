"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScrollText, RefreshCw, Check, Pencil, X, Clock, AlertTriangle,
  ShieldAlert, Flame, Lightbulb, Users, Wrench,
} from "lucide-react";

type Reco = {
  id: number; agent_id: string; tipo: string; titulo: string; descripcion: string | null;
  prioridad: number | null; severidad: "critica" | "importante" | "oportunidad";
  impacto_estimado: number | null; valor_esperado: number | null; confianza: number | null;
  estado: string; entity_type: string | null; entity_id: string | null;
  action_tool: string | null; action_input: any; action_queue_id: number | null;
  evidencia: any; agentes: string[];
};
type Grupos = { total: number; criticas: Reco[]; importantes: Reco[]; oportunidades: Reco[] };
type JefeRow = {
  resumen: string; prioridades: any[]; conteos: any; conflictos: any[];
  generado_por: string; generado_en: string; fecha: string; resultado: string;
} | null;

function ars(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

const SEV_META = {
  critica: { label: "Críticas", icon: Flame, dot: "bg-red-500", chip: "bg-red-50 text-red-700 border-red-200" },
  importante: { label: "Importantes", icon: ShieldAlert, dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  oportunidad: { label: "Oportunidades", icon: Lightbulb, dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
} as const;

export default function DecisionesPage() {
  const [grupos, setGrupos] = useState<Grupos>({ total: 0, criticas: [], importantes: [], oportunidades: [] });
  const [jefe, setJefe] = useState<JefeRow>(null);
  const [loading, setLoading] = useState(true);
  const [regenerando, setRegenerando] = useState(false);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [precioEdit, setPrecioEdit] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rr, jr] = await Promise.all([
      fetch("/api/agentes/recomendaciones").then(r => r.json()).catch(() => null),
      fetch("/api/agentes/jefe-resumen").then(r => r.json()).catch(() => null),
    ]);
    if (rr && !rr.error) setGrupos(rr);
    if (jr) setJefe(jr.resumen ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function regenerarJefe() {
    setRegenerando(true); setMsg(null);
    await fetch("/api/agentes/jefe-resumen", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    await load();
    setRegenerando(false);
  }

  async function actuar(id: number, decision: string, input?: any) {
    setProcesando(id); setMsg(null);
    const res = await fetch("/api/agentes/recomendaciones", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, input }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.error ?? "No se pudo aplicar la acción.");
    setEditando(null);
    await load();
    setProcesando(null);
  }

  function abrirEdicion(r: Reco) {
    setEditando(r.id);
    setPrecioEdit(r.action_input?.precio != null ? String(r.action_input.precio) : "");
  }
  function guardarEdicion(r: Reco) {
    const precio = Number(precioEdit);
    if (!Number.isFinite(precio) || precio <= 0) { setMsg("Precio inválido."); return; }
    actuar(r.id, "editar", { ...(r.action_input ?? {}), precio });
  }

  const tarjeta = (r: Reco) => {
    const meta = SEV_META[r.severidad];
    const editable = r.action_tool === "aplicar_precio" && r.action_input?.precio != null;
    return (
      <div key={r.id} className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
              <h4 className="font-semibold text-gray-900 text-sm">{r.titulo}</h4>
              {r.action_tool && (
                <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Wrench size={11} /> {r.action_tool}
                </span>
              )}
            </div>
            {r.descripcion && <p className="text-sm text-gray-600 mt-1">{r.descripcion}</p>}
          </div>
          {r.prioridad != null && (
            <span className="text-[11px] font-mono text-gray-400 whitespace-nowrap">P{r.prioridad}</span>
          )}
        </div>

        {/* Meta: impacto, confianza, agentes */}
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 text-xs text-gray-500">
          {(r.valor_esperado != null || r.impacto_estimado != null) && (
            <span>Impacto: <b className="text-gray-800">{ars(r.valor_esperado ?? r.impacto_estimado)}</b>{r.valor_esperado != null ? " (esperado)" : ""}</span>
          )}
          {r.confianza != null && <span>Confianza: <b className="text-gray-800">{r.confianza}%</b></span>}
          <span className="inline-flex items-center gap-1"><Users size={12} /> {r.agentes.join(", ")}</span>
        </div>

        {/* Edición inline (solo aplicar_precio) */}
        {editando === r.id && editable && (
          <div className="flex items-center gap-2 mt-3">
            <label className="text-xs text-gray-500">Nuevo precio:</label>
            <input type="number" value={precioEdit} onChange={e => setPrecioEdit(e.target.value)}
              className="w-32 border rounded-lg px-2 py-1 text-sm" />
            <button onClick={() => guardarEdicion(r)} className="text-xs bg-gray-800 text-white px-2.5 py-1 rounded-lg">Guardar</button>
            <button onClick={() => setEditando(null)} className="text-xs text-gray-500">Cancelar</button>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
          <button onClick={() => actuar(r.id, "aprobar")} disabled={procesando === r.id}
            className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
            <Check size={13} /> {r.action_tool ? "Aprobar y ejecutar" : "Marcar atendida"}
          </button>
          {editable && (
            <button onClick={() => abrirEdicion(r)} disabled={procesando === r.id}
              className="inline-flex items-center gap-1 text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Pencil size={13} /> Editar
            </button>
          )}
          <button onClick={() => actuar(r.id, "posponer")} disabled={procesando === r.id}
            className="inline-flex items-center gap-1 text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
            <Clock size={13} /> Posponer
          </button>
          <button onClick={() => actuar(r.id, "rechazar")} disabled={procesando === r.id}
            className="inline-flex items-center gap-1 text-xs font-medium border border-gray-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
            <X size={13} /> Rechazar
          </button>
        </div>
      </div>
    );
  };

  const seccion = (sev: keyof typeof SEV_META, items: Reco[]) => {
    if (!items.length) return null;
    const meta = SEV_META[sev];
    const Icon = meta.icon;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">{meta.label}</h3>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.chip}`}>{items.length}</span>
        </div>
        <div className="grid gap-3">{items.map(tarjeta)}</div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="text-emerald-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Centro de Decisiones</h1>
            <p className="text-sm text-gray-500">Lo que necesita tu atención, priorizado por el Jefe de Gabinete.</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 shrink-0">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {msg && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{msg}</p>}

      {/* Resumen del Jefe */}
      <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 p-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-emerald-900 flex items-center gap-2">🧑‍💼 Resumen del Jefe de Gabinete</h2>
          <button onClick={regenerarJefe} disabled={regenerando}
            className="text-xs text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 disabled:opacity-50">
            <RefreshCw size={12} className={regenerando ? "animate-spin" : ""} /> Regenerar
          </button>
        </div>
        {jefe ? (
          <>
            <p className="text-sm text-gray-700 whitespace-pre-line">{jefe.resumen}</p>
            {Array.isArray(jefe.conflictos) && jefe.conflictos.length > 0 && (
              <div className="mt-3 space-y-1">
                {jefe.conflictos.map((c: any, i: number) => (
                  <p key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 inline-flex items-start gap-1.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {c.motivo}{c.agentes?.length ? ` — fuentes: ${c.agentes.join(", ")}` : ""}
                  </p>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-2 font-mono">
              {jefe.fecha} · {jefe.generado_por === "ia" ? "redactado con IA" : "reglas"}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">Todavía no hay resumen. Tocá <b>Regenerar</b> para que el Jefe priorice las recomendaciones actuales.</p>
        )}
      </div>

      {/* Grupos por severidad */}
      {loading ? (
        <p className="text-center text-gray-400 py-16 text-sm">Cargando…</p>
      ) : grupos.total === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <p className="text-sm mb-1">No hay decisiones pendientes.</p>
          <p className="text-xs">Cuando los agentes detecten oportunidades, aparecen acá priorizadas.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {seccion("critica", grupos.criticas)}
          {seccion("importante", grupos.importantes)}
          {seccion("oportunidad", grupos.oportunidades)}
        </div>
      )}
    </div>
  );
}
