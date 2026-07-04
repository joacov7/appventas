"use client";

import { useEffect, useState } from "react";
import { Brain, RefreshCw, Trash2, Search, Star } from "lucide-react";

type Stat = { namespace: string; total: number };
type Entry = {
  id: number; namespace: string; kind: string | null; key: string;
  value: any; tags: string[]; source: string | null; confidence: number;
  hits: number; updated_at: string;
};

const LABELS: Record<string, string> = {
  productos: "Productos", clientes: "Clientes", comercial: "Comercial",
  mercadolibre: "Mercado Libre", ia: "Caché de IA", reglas: "Reglas",
  aprendizajes: "Aprendizajes", decisiones: "Decisiones",
};

export default function MemoriaPage() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadStats() {
    const r = await fetch("/api/memoria");
    if (r.ok) setStats((await r.json()).stats ?? []);
  }
  async function loadEntries(ns: string, query = "") {
    setLoading(true); setSel(ns);
    const r = await fetch(`/api/memoria?namespace=${ns}${query ? `&q=${encodeURIComponent(query)}` : ""}`);
    if (r.ok) setEntries((await r.json()).entries ?? []);
    setLoading(false);
  }
  async function borrar(id: number) {
    if (!confirm("¿Olvidar esta entrada?")) return;
    await fetch(`/api/memoria?id=${id}`, { method: "DELETE" });
    if (sel) loadEntries(sel, q);
    loadStats();
  }

  useEffect(() => { loadStats(); }, []);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <Brain className="text-indigo-600" size={24} />
        <h1 className="text-xl font-bold text-gray-900">Centro de Memoria</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        El conocimiento de la empresa. Cada agente lo consulta y lo alimenta. La IA solo se usa cuando la memoria no alcanza.
      </p>

      {/* Espacios */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.keys(LABELS).map(ns => {
          const s = stats.find(x => x.namespace === ns);
          const total = s?.total ?? 0;
          return (
            <button key={ns} onClick={() => loadEntries(ns)}
              className={`text-left rounded-2xl border p-4 transition-all ${sel === ns ? "border-indigo-300 ring-2 ring-indigo-100 bg-indigo-50" : "bg-white hover:border-indigo-200"}`}>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500 mt-0.5">{LABELS[ns]}</p>
            </button>
          );
        })}
      </div>

      {sel && (
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="font-semibold text-gray-900">{LABELS[sel] ?? sel}</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={q} onChange={e => setQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadEntries(sel, q)}
                  placeholder="Buscar..."
                  className="border rounded-xl pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button onClick={() => loadEntries(sel, q)} className="p-2 text-gray-400 hover:text-gray-700"><RefreshCw size={15} /></button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Cargando...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Todavía no hay memoria en este espacio.</p>
          ) : (
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id} className="border rounded-xl p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {e.kind && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.kind}</span>}
                        {e.tags?.map(t => <span key={t} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t}</span>)}
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Star size={10} /> {(e.confidence * 100).toFixed(0)}% · {e.hits} usos</span>
                      </div>
                      <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap break-words font-mono bg-gray-50 rounded-lg p-2 overflow-x-auto">
{JSON.stringify(e.value, null, 2).slice(0, 500)}
                      </pre>
                    </div>
                    <button onClick={() => borrar(e.id)} className="p-1.5 text-gray-300 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
