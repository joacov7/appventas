"use client";

import { useEffect, useState } from "react";
import { Users, RefreshCw, Star, ExternalLink } from "lucide-react";

type Lead = {
  id: number;
  autor: string;
  calificacion: number;
  competidor: string;
  estado: string;
  mensaje_abordaje: string;
  texto_queja: string;
  url_perfil: string;
  creado_en: string;
};

const ESTADOS = ["nuevo", "contactado", "interesado", "descartado"];

const estadoColor: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  contactado: "bg-yellow-100 text-yellow-700",
  interesado: "bg-emerald-100 text-emerald-700",
  descartado: "bg-gray-100 text-gray-500",
};

export default function CaptacionPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function fetchLeads(estado?: string) {
    setLoading(true);
    const url = estado ? `/api/captacion?estado=${estado}` : "/api/captacion";
    const res = await fetch(url);
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchLeads(); }, []);

  async function cambiarEstado(id: number, estado: string) {
    await fetch("/api/captacion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, estado } : l));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-emerald-600" size={22} />
          <h1 className="text-xl font-bold text-gray-900">Captación de Leads</h1>
          <span className="text-sm text-gray-400 font-normal">({leads.length})</span>
        </div>
        <button
          onClick={() => fetchLeads(filtro || undefined)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => { setFiltro(""); fetchLeads(); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filtro === "" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          Todos
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e}
            onClick={() => { setFiltro(e); fetchLeads(e); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filtro === e ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {e}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando leads...</p>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay leads todavía.</p>
          <p className="text-xs mt-1">El scraper corre automáticamente cada día a las 8am.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{lead.autor}</span>
                    <span className="flex items-center gap-0.5 text-yellow-500 text-xs">
                      {Array.from({ length: lead.calificacion }).map((_, i) => (
                        <Star key={i} size={11} fill="currentColor" />
                      ))}
                    </span>
                    <span className="text-xs text-gray-400">— {lead.competidor}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{lead.texto_queja}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={lead.estado}
                    onChange={(e) => cambiarEstado(lead.id, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${estadoColor[lead.estado] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mensaje de abordaje */}
              <div className="mt-3">
                <button
                  onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {expanded === lead.id ? "Ocultar mensaje" : "Ver mensaje de abordaje"}
                </button>
                {expanded === lead.id && (
                  <div className="mt-2 bg-emerald-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
                    {lead.mensaje_abordaje}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(lead.mensaje_abordaje)}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        Copiar
                      </button>
                      {lead.url_perfil && !lead.url_perfil.startsWith("sin_url") && (
                        <a
                          href={lead.url_perfil}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        >
                          <ExternalLink size={11} />
                          Ver perfil
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-300 mt-2">
                {new Date(lead.creado_en).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
