"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Check, X, RefreshCw, Wrench, Clock } from "lucide-react";

type Accion = {
  id: number; agent_id: string; tool: string; input: any; estado: string;
  created_at: string; resuelto_en: string | null; resultado: any;
  tool_desc: string | null; tool_categoria: string | null;
};

function fmt(s: string) {
  return new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  ejecutada: "bg-emerald-100 text-emerald-700",
  rechazada: "bg-gray-100 text-gray-500",
  error: "bg-red-100 text-red-700",
};

export default function AprobacionesPage() {
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/agentes/acciones${verHistorial ? "?historial=1" : ""}`);
    if (r.ok) setAcciones((await r.json()).acciones ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [verHistorial]);

  async function resolver(id: number, decision: "aprobar" | "rechazar") {
    setProcesando(id);
    try {
      await fetch("/api/agentes/acciones", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }),
      });
      await load();
    } finally { setProcesando(null); }
  }

  const pendientes = acciones.filter(a => a.estado === "pendiente");

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <CheckSquare className="text-indigo-600" size={24} />
        <h1 className="text-xl font-bold text-gray-900">Aprobaciones</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Acciones que los agentes proponen (modo Manual o Asistido) esperando tu OK. Al aprobar, la acción se ejecuta de verdad.
      </p>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={() => setVerHistorial(false)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${!verHistorial ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
            Pendientes {!verHistorial && pendientes.length > 0 && `(${pendientes.length})`}
          </button>
          <button onClick={() => setVerHistorial(true)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${verHistorial ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
            Historial
          </button>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-700"><RefreshCw size={15} /></button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : acciones.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare size={40} strokeWidth={1} className="mx-auto mb-3" />
          <p className="mb-1">{verHistorial ? "Sin historial todavía." : "No hay acciones pendientes."}</p>
          <p className="text-xs">Cuando un agente proponga una acción, aparece acá para que la apruebes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {acciones.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{a.agent_id}</span>
                    <span className="text-sm font-medium text-gray-900 flex items-center gap-1"><Wrench size={12} /> {a.tool}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[a.estado] ?? ""}`}>{a.estado}</span>
                  </div>
                  {a.tool_desc && <p className="text-xs text-gray-500 mt-1">{a.tool_desc}</p>}
                  <pre className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
{JSON.stringify(a.input, null, 2).slice(0, 400)}
                  </pre>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock size={10} /> {fmt(a.created_at)}</p>
                </div>
                {a.estado === "pendiente" && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => resolver(a.id, "aprobar")} disabled={procesando !== null}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                      <Check size={12} /> Aprobar
                    </button>
                    <button onClick={() => resolver(a.id, "rechazar")} disabled={procesando !== null}
                      className="flex items-center gap-1 text-gray-500 hover:text-red-600 text-xs px-3 py-1.5">
                      <X size={12} /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
