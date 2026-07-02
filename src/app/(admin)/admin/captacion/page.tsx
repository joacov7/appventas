"use client";

import { useEffect, useState } from "react";
import { Users, RefreshCw, Star, ExternalLink, Plus, Trash2, MapPin, X, MessageCircle, Search, Store, Phone, Globe, Instagram, Facebook } from "lucide-react";

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

type Negocio = {
  id: number;
  nombre: string;
  url: string;
  activo: boolean;
  creado_en: string;
};

type Prospecto = {
  id: number;
  nombre: string;
  rubro: string | null;
  direccion: string | null;
  telefono: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  provincia: string | null;
  lat: number | null;
  lon: number | null;
  estado: string;
  notas: string | null;
  creado_en: string;
};

const RUBROS_PROSPECTO: { key: string; label: string }[] = [
  { key: "regaleria", label: "Regalerías" },
  { key: "tabaqueria", label: "Tabaquerías" },
  { key: "kiosco", label: "Kioscos / Almacenes" },
  { key: "bazar", label: "Bazares" },
  { key: "hogar", label: "Artículos de hogar" },
  { key: "artesanias", label: "Artesanías" },
];

const ESTADOS = ["nuevo", "contactado", "interesado", "descartado"];

const estadoColor: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  contactado: "bg-yellow-100 text-yellow-700",
  interesado: "bg-emerald-100 text-emerald-700",
  descartado: "bg-gray-100 text-gray-500",
};

export default function CaptacionPage() {
  const [tab, setTab] = useState<"prospectos" | "leads" | "negocios">("prospectos");

  // ── Prospectos ──
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [pLoading, setPLoading] = useState(true);
  const [pFiltro, setPFiltro] = useState("");
  const [pZona, setPZona] = useState("");
  const [pPais, setPPais] = useState("Argentina");
  const [pRubros, setPRubros] = useState<string[]>(["regaleria", "tabaqueria", "bazar"]);
  const [pBuscando, setPBuscando] = useState(false);
  const [pMsg, setPMsg] = useState("");

  // ── Leads ──
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  // ── Negocios ──
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [nLoading, setNLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nForm, setNForm] = useState({ nombre: "", url: "" });
  const [nSaving, setNSaving] = useState(false);
  const [nError, setNError] = useState("");

  async function fetchLeads(estado?: string) {
    setLoading(true);
    const url = estado ? `/api/captacion?estado=${estado}` : "/api/captacion";
    const res = await fetch(url);
    setLeads(Array.isArray(await res.json()) ? await res.clone().json() : []);
    setLoading(false);
  }

  async function fetchNegocios() {
    setNLoading(true);
    const res = await fetch("/api/captacion/negocios");
    if (res.ok) setNegocios(await res.json());
    setNLoading(false);
  }

  async function fetchProspectos(estado?: string) {
    setPLoading(true);
    const url = estado ? `/api/captacion/prospectos?estado=${estado}` : "/api/captacion/prospectos";
    const res = await fetch(url);
    if (res.ok) setProspectos(await res.json());
    setPLoading(false);
  }

  useEffect(() => { fetchProspectos(); fetchLeads(); fetchNegocios(); }, []);

  async function buscarProspectos() {
    if (!pZona.trim()) { setPMsg("Escribí una provincia o ciudad"); return; }
    if (!pRubros.length) { setPMsg("Elegí al menos un rubro"); return; }
    setPBuscando(true); setPMsg("");
    try {
      const res = await fetch("/api/captacion/prospectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zona: pZona.trim(), pais: pPais.trim() || "Argentina", rubros: pRubros }),
      });
      const data = await res.json();
      if (!res.ok) { setPMsg(data.error ?? "Error en la búsqueda"); return; }
      if (data.total === 0) { setPMsg(data.error ?? "Sin resultados"); return; }
      setPMsg(`Se encontraron y guardaron ${data.total} comercios en ${pZona.trim()}.`);
      fetchProspectos(pFiltro || undefined);
    } catch {
      setPMsg("Error de conexión");
    } finally { setPBuscando(false); }
  }

  async function cambiarEstadoProspecto(id: number, estado: string) {
    await fetch(`/api/captacion/prospectos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    setProspectos((prev) => prev.map((p) => p.id === id ? { ...p, estado } : p));
  }

  async function delProspecto(id: number) {
    if (!confirm("¿Eliminar este prospecto?")) return;
    await fetch(`/api/captacion/prospectos/${id}`, { method: "DELETE" });
    setProspectos((prev) => prev.filter((p) => p.id !== id));
  }

  function waLink(tel: string) {
    const d = tel.replace(/[^\d]/g, "");
    const num = d.startsWith("54") ? d : `54${d}`;
    return `https://wa.me/${num}`;
  }

  async function cambiarEstado(id: number, estado: string) {
    await fetch("/api/captacion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, estado } : l));
  }

  async function addNegocio() {
    if (!nForm.url.trim()) { setNError("La URL es requerida"); return; }
    setNSaving(true); setNError("");
    try {
      const res = await fetch("/api/captacion/negocios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nForm),
      });
      if (!res.ok) { setNError((await res.json()).error ?? "Error"); return; }
      setNForm({ nombre: "", url: "" });
      setShowForm(false);
      fetchNegocios();
    } finally { setNSaving(false); }
  }

  async function toggleNegocio(n: Negocio) {
    await fetch(`/api/captacion/negocios/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !n.activo }),
    });
    fetchNegocios();
  }

  async function delNegocio(n: Negocio) {
    if (!confirm(`¿Eliminar "${n.nombre}"?`)) return;
    await fetch(`/api/captacion/negocios/${n.id}`, { method: "DELETE" });
    fetchNegocios();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users className="text-emerald-600" size={22} />
        <h1 className="text-xl font-bold text-gray-900">Captación de Leads</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: "prospectos", label: `Prospectos (${prospectos.length})` },
          { key: "leads", label: `Reseñas negativas (${leads.length})` },
          { key: "negocios", label: `Negocios competidores (${negocios.length})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Prospectos ──────────────────────────────────────────────────── */}
      {tab === "prospectos" && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 text-sm text-emerald-800">
            <p className="font-medium mb-1 flex items-center gap-2"><Store size={16} /> Buscá revendedores automáticamente</p>
            <p className="text-emerald-700">Escribí una provincia o ciudad y elegí rubros. El sistema busca comercios reales (regalerías, tabaquerías, bazares) con su dirección y contacto para que les ofrezcas mates al por mayor sin buscarlos uno por uno.</p>
          </div>

          {/* Buscador */}
          <div className="bg-white rounded-2xl border p-5 mb-5 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Provincia o ciudad</label>
                <input
                  value={pZona}
                  onChange={(e) => setPZona(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarProspectos()}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ej: Córdoba, Rosario, Mendoza"
                />
              </div>
              <div className="sm:w-48">
                <label className="text-sm font-medium text-gray-700">País</label>
                <input
                  value={pPais}
                  onChange={(e) => setPPais(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarProspectos()}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Argentina"
                />
              </div>
              <div className="flex items-end">
                <button onClick={buscarProspectos} disabled={pBuscando}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
                  {pBuscando ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                  {pBuscando ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {RUBROS_PROSPECTO.map((r) => {
                const on = pRubros.includes(r.key);
                return (
                  <button key={r.key}
                    onClick={() => setPRubros(prev => on ? prev.filter(x => x !== r.key) : [...prev, r.key])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${on ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {r.label}
                  </button>
                );
              })}
            </div>
            {pMsg && <p className={`text-sm mt-3 ${pMsg.startsWith("Se encontraron") ? "text-emerald-600" : "text-amber-600"}`}>{pMsg}</p>}
          </div>

          {/* Filtros de estado */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setPFiltro(""); fetchProspectos(); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${pFiltro === "" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                Todos
              </button>
              {ESTADOS.map((e) => (
                <button key={e} onClick={() => { setPFiltro(e); fetchProspectos(e); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${pFiltro === e ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {pLoading ? (
            <p className="text-gray-400 text-sm">Cargando prospectos...</p>
          ) : prospectos.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Store size={40} strokeWidth={1} className="mx-auto mb-3" />
              <p className="mb-2">Todavía no buscaste comercios.</p>
              <p className="text-xs max-w-sm mx-auto">Escribí una provincia arriba y hacé clic en Buscar para traer revendedores potenciales.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prospectos.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{p.nombre}</span>
                        {p.rubro && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{p.rubro}</span>}
                        {p.provincia && <span className="text-xs text-gray-400">{p.provincia}</span>}
                      </div>
                      {p.direccion && <p className="text-sm text-gray-600 mt-1 flex items-center gap-1"><MapPin size={12} className="shrink-0" /> {p.direccion}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {p.telefono && (
                          <>
                            <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} /> {p.telefono}</span>
                            <a href={waLink(p.telefono)} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-medium px-3 py-1 rounded-full transition-colors">
                              <MessageCircle size={12} fill="white" strokeWidth={0} /> WhatsApp
                            </a>
                          </>
                        )}
                        {p.instagram && (
                          <a href={p.instagram} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-pink-500 hover:text-pink-600 flex items-center gap-1"><Instagram size={11} /> Instagram</a>
                        )}
                        {p.facebook && (
                          <a href={p.facebook} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><Facebook size={11} /> Facebook</a>
                        )}
                        {p.website && (
                          <a href={p.website.startsWith("http") ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1"><Globe size={11} /> Sitio web</a>
                        )}
                        {p.lat && p.lon && (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1"><ExternalLink size={11} /> Ver en mapa</a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <select
                        value={p.estado}
                        onChange={(e) => cambiarEstadoProspecto(p.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${estadoColor[p.estado] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <button onClick={() => delProspecto(p.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB: Leads ──────────────────────────────────────────────────────── */}
      {tab === "leads" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setFiltro(""); fetchLeads(); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filtro === "" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                Todos
              </button>
              {ESTADOS.map((e) => (
                <button key={e} onClick={() => { setFiltro(e); fetchLeads(e); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filtro === e ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {e}
                </button>
              ))}
            </div>
            <button onClick={() => fetchLeads(filtro || undefined)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
              <RefreshCw size={15} /> Actualizar
            </button>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">Cargando leads...</p>
          ) : leads.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="mb-2">No hay leads todavía.</p>
              <p className="text-xs max-w-sm mx-auto">
                Agregá negocios competidores en la pestaña de al lado y el scraper extraerá reseñas negativas en el próximo ciclo.
              </p>
              <button onClick={() => setTab("negocios")} className="mt-4 text-sm text-emerald-600 hover:underline">
                → Agregar negocios competidores
              </button>
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
                    <select
                      value={lead.estado}
                      onChange={(e) => cambiarEstado(lead.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer shrink-0 ${estadoColor[lead.estado] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
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
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <button onClick={() => navigator.clipboard.writeText(lead.mensaje_abordaje)}
                            className="text-xs text-emerald-600 hover:underline">Copiar texto</button>
                          {lead.url_perfil && !lead.url_perfil.startsWith("sin_url") && (
                            <a href={lead.url_perfil} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                              <ExternalLink size={11} /> Ver perfil
                            </a>
                          )}
                          {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(lead.mensaje_abordaje)}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                            >
                              <MessageCircle size={12} fill="white" strokeWidth={0} />
                              Enviar por WhatsApp
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
        </>
      )}

      {/* ── TAB: Negocios competidores ───────────────────────────────────────── */}
      {tab === "negocios" && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-sm text-amber-800">
            <p className="font-medium mb-1">¿Por qué agregar negocios manualmente?</p>
            <p className="text-amber-700">Google Maps bloquea las búsquedas automáticas desde servidores cloud. Pegá la URL de Google Maps de cada competidor y el scraper extraerá sus reseñas negativas directamente.</p>
          </div>

          <div className="flex justify-end mb-4">
            <button onClick={() => { setShowForm(true); setNError(""); }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={16} /> Agregar negocio
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-white rounded-2xl border p-5 mb-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin size={16} className="text-emerald-600" /> Agregar negocio competidor
                </h3>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">URL de Google Maps *</label>
                  <input
                    value={nForm.url}
                    onChange={(e) => setNForm(f => ({ ...f, url: e.target.value }))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://www.google.com/maps/place/Nombre+Local/..."
                  />
                  <p className="text-xs text-gray-400 mt-1">Buscalo en Google Maps, hacé clic en Compartir y copiá el link.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nombre (opcional)</label>
                  <input
                    value={nForm.nombre}
                    onChange={(e) => setNForm(f => ({ ...f, nombre: e.target.value }))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ej: Regalería El Gaucho"
                  />
                </div>
                {nError && <p className="text-sm text-red-600">{nError}</p>}
                <div className="flex gap-3">
                  <button onClick={addNegocio} disabled={nSaving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium">
                    {nSaving ? "Guardando..." : "Agregar"}
                  </button>
                  <button onClick={() => setShowForm(false)} className="px-4 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {nLoading ? (
            <div className="text-center py-12 text-gray-400">Cargando...</div>
          ) : negocios.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MapPin size={40} strokeWidth={1} className="mx-auto mb-3" />
              <p className="mb-2">No hay negocios cargados.</p>
              <p className="text-xs">Agregá los Google Maps de tus competidores para que el scraper extraiga sus reseñas.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Negocio</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-left">Agregado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {negocios.map((n) => (
                    <tr key={n.id} className={n.activo ? "" : "opacity-50"}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{n.nombre}</p>
                        <a href={n.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1 mt-0.5">
                          <ExternalLink size={10} /> Ver en Maps
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleNegocio(n)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            n.activo ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}>
                          {n.activo ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(n.creado_en).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => delNegocio(n)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
