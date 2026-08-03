"use client";

import { useEffect, useState } from "react";
import { KanbanSquare, RefreshCw, ChevronRight } from "lucide-react";

interface Lead { wa_id: string; texto: string; fecha: string; nombre: string | null; segmento: string | null; etapa: string }

const ETAPAS: { clave: string; label: string; color: string }[] = [
  { clave: "nuevo", label: "Nuevo", color: "bg-gray-100 text-gray-600" },
  { clave: "calificado", label: "Calificado", color: "bg-blue-100 text-blue-700" },
  { clave: "presentado", label: "Presentado", color: "bg-indigo-100 text-indigo-700" },
  { clave: "negociacion", label: "Negociación", color: "bg-amber-100 text-amber-700" },
  { clave: "ganado", label: "Ganado", color: "bg-emerald-100 text-emerald-700" },
  { clave: "perdido", label: "Perdido", color: "bg-red-100 text-red-600" },
];
const SEG: Record<string, string> = { minorista: "🛍️", mayorista: "📦", empresarial: "🏢" };

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    const d = await fetch("/api/ventas/pipeline").then(r => r.json()).catch(() => ({ leads: [] }));
    setLeads(d.leads ?? []);
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  async function mover(wa_id: string, etapa: string) {
    setLeads(prev => prev.map(l => l.wa_id === wa_id ? { ...l, etapa } : l));
    await fetch("/api/ventas/pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wa_id, etapa }) });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <KanbanSquare className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pipeline de ventas</h1>
          <p className="text-sm text-gray-500">Cada conversación de WhatsApp es un lead. Movelos por etapa.</p>
        </div>
        <button onClick={cargar} className="ml-auto text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {cargando ? <p className="text-sm text-gray-400">Cargando…</p> : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {ETAPAS.map(col => {
            const items = leads.filter(l => l.etapa === col.clave);
            return (
              <div key={col.clave} className="shrink-0 w-64">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.color}`}>{col.label}</span>
                  <span className="text-xs text-gray-400">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(l => (
                    <div key={l.wa_id} className="bg-white rounded-xl border border-gray-100 p-3">
                      <p className="text-sm font-medium text-gray-800 truncate">{SEG[l.segmento ?? ""] ?? "💬"} {l.nombre || l.wa_id}</p>
                      <p className="text-xs text-gray-400 truncate">{l.texto}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <select value={l.etapa} onChange={e => mover(l.wa_id, e.target.value)}
                          className="text-xs border rounded-lg px-1.5 py-1 bg-white text-gray-600 flex-1">
                          {ETAPAS.map(e => <option key={e.clave} value={e.clave}>{e.label}</option>)}
                        </select>
                        <a href={`/admin/bandeja`} title="Abrir en Bandeja" className="text-gray-300 hover:text-emerald-600"><ChevronRight size={16} /></a>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-gray-300 px-1">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
