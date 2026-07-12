"use client";

import { useEffect, useState } from "react";
import { Users, RefreshCw, Plus, Trash2, X, MessageCircle, Search, Store, Phone, Globe, Instagram, Facebook, ExternalLink, MapPin } from "lucide-react";

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
  mensaje_abordaje: string | null;
  creado_en: string;
};

// Prioridad de contacto: nuevos y contactables primero
function prioridadProspecto(p: Prospecto): number {
  let score = 0;
  if (p.estado === "nuevo") score += 4;
  else if (p.estado === "interesado") score += 6; // los calientes, arriba de todo
  else if (p.estado === "contactado") score += 2;
  if (p.telefono) score += 3;
  if (p.instagram || p.facebook) score += 1;
  return score;
}

const GRUPOS_RUBRO: { grupo: string; rubros: { key: string; label: string }[] }[] = [
  {
    grupo: "Barrido amplio (toda la zona)",
    rubros: [
      { key: "todos_comercios", label: "🏬 Todos los comercios" },
      { key: "todas_oficinas", label: "🏢 Todas las oficinas/empresas" },
    ],
  },
  {
    grupo: "Comercios (revendedores)",
    rubros: [
      { key: "regaleria", label: "Regalerías" },
      { key: "tabaqueria", label: "Tabaquerías" },
      { key: "kiosco", label: "Kioscos / Almacenes" },
      { key: "bazar", label: "Bazares" },
      { key: "hogar", label: "Artículos de hogar" },
      { key: "artesanias", label: "Artesanías" },
      { key: "ropa", label: "Indumentaria" },
      { key: "joyeria", label: "Joyería / bijou" },
      { key: "floreria", label: "Florerías" },
      { key: "libreria", label: "Librerías" },
      { key: "deportes", label: "Deportes" },
      { key: "supermercado", label: "Supermercados" },
      { key: "ferreteria", label: "Ferreterías" },
      { key: "mascotas", label: "Mascotas" },
      { key: "agropecuaria", label: "Agropecuarias" },
    ],
  },
  {
    grupo: "Empresas (clientes de personalizados)",
    rubros: [
      { key: "industria", label: "Industrias / fábricas" },
      { key: "empresa", label: "Empresas / oficinas" },
      { key: "publicidad", label: "Agencias de publicidad" },
      { key: "seguros", label: "Agencias de seguros" },
      { key: "inmobiliaria", label: "Inmobiliarias" },
      { key: "cooperativa", label: "Cooperativas" },
      { key: "acopio", label: "Silos / acopio" },
      { key: "gobierno", label: "Organismos públicos" },
    ],
  },
];

const ESTADOS = ["nuevo", "contactado", "interesado", "descartado"];

const estadoColor: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  contactado: "bg-yellow-100 text-yellow-700",
  interesado: "bg-emerald-100 text-emerald-700",
  descartado: "bg-gray-100 text-gray-500",
};

export default function CaptacionPage() {
  // ── Prospectos ──
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [pLoading, setPLoading] = useState(true);
  const [pFiltro, setPFiltro] = useState("");
  const [pZona, setPZona] = useState("");
  const [pPais, setPPais] = useState("Argentina");
  const [pRubros, setPRubros] = useState<string[]>(["regaleria", "tabaqueria", "bazar"]);
  const [pBuscando, setPBuscando] = useState(false);
  const [pMsg, setPMsg] = useState("");
  // Alta manual de contacto
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<any>({ nombre: "", rubro: "", telefono: "", email: "", instagram: "", facebook: "", website: "", provincia: "", notas: "" });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  // Filtros de la lista de resultados
  const [pTexto, setPTexto] = useState("");
  const [pRubroFiltro, setPRubroFiltro] = useState("");
  const [pZonaFiltro, setPZonaFiltro] = useState("");
  const [pSoloContacto, setPSoloContacto] = useState(false);

  async function fetchProspectos(estado?: string) {
    setPLoading(true);
    const url = estado ? `/api/captacion/prospectos?estado=${estado}` : "/api/captacion/prospectos";
    const res = await fetch(url);
    if (res.ok) setProspectos(await res.json());
    setPLoading(false);
  }

  useEffect(() => { fetchProspectos(); }, []);

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

  async function guardarManual() {
    if (!manualForm.nombre.trim()) { setManualError("El nombre es obligatorio"); return; }
    setManualSaving(true); setManualError("");
    try {
      const res = await fetch("/api/captacion/prospectos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true, ...manualForm }),
      });
      if (res.ok) {
        setManualOpen(false);
        setManualForm({ nombre: "", rubro: "", telefono: "", email: "", instagram: "", facebook: "", website: "", provincia: "", notas: "" });
        fetchProspectos(pFiltro || undefined);
      } else setManualError((await res.json()).error ?? "Error al guardar");
    } catch { setManualError("Error de conexión"); }
    finally { setManualSaving(false); }
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

  function waLink(tel: string, texto?: string | null) {
    const d = tel.replace(/[^\d]/g, "");
    const num = d.startsWith("54") ? d : `54${d}`;
    return `https://wa.me/${num}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
  }

  const [generandoMsg, setGenerandoMsg] = useState<number | null>(null);
  const [msgAbierto, setMsgAbierto] = useState<number | null>(null);

  async function generarAbordaje(p: Prospecto) {
    setGenerandoMsg(p.id);
    try {
      const r = await fetch("/api/empleado/abordaje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectoId: p.id }),
      });
      const data = await r.json();
      if (r.ok) {
        setProspectos(prev => prev.map(x => x.id === p.id ? { ...x, mensaje_abordaje: data.mensaje } : x));
        setMsgAbierto(p.id);
      } else {
        alert(data.error ?? "Error al generar el mensaje");
      }
    } catch {
      alert("Error de conexión");
    } finally { setGenerandoMsg(null); }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users className="text-emerald-600" size={22} />
        <h1 className="text-xl font-bold text-gray-900">Captación de Leads</h1>
      </div>

      {/* ── Prospectos ───────────────────────────────────────────────────────── */}
      {(
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 text-sm text-emerald-800">
            <p className="font-medium mb-1 flex items-center gap-2"><Store size={16} /> Buscá clientes automáticamente</p>
            <p className="text-emerald-700">Escribí una provincia o ciudad y elegí rubros. Encontrá <strong>comercios</strong> para venta mayorista o <strong>empresas</strong> (industrias, agencias, cooperativas, acopios) que compran mates personalizados como regalo corporativo — con su dirección y contacto, sin buscarlos uno por uno.</p>
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
            <div className="space-y-2.5">
              {GRUPOS_RUBRO.map((g) => (
                <div key={g.grupo}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{g.grupo}</p>
                  <div className="flex gap-2 flex-wrap">
                    {g.rubros.map((r) => {
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
                </div>
              ))}
            </div>
            {pMsg && <p className={`text-sm mt-3 ${pMsg.startsWith("Se encontraron") ? "text-emerald-600" : "text-amber-600"}`}>{pMsg}</p>}
          </div>

          {/* Filtros de estado */}
          <div className="flex items-center justify-between mb-3">
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
            <button onClick={() => { setManualOpen(true); setManualError(""); }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg shrink-0">
              <Plus size={15} /> Cargar contacto
            </button>
          </div>

          {manualOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setManualOpen(false)}>
              <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
                  <h2 className="font-semibold text-gray-900">Cargar contacto manual</h2>
                  <button onClick={() => setManualOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <div className="p-5 grid grid-cols-2 gap-3">
                  {([
                    ["nombre", "Nombre *", "col-span-2"],
                    ["rubro", "Rubro", ""],
                    ["provincia", "Zona / provincia", ""],
                    ["telefono", "Teléfono", ""],
                    ["email", "Email", ""],
                    ["website", "Sitio web", ""],
                    ["instagram", "Instagram", ""],
                    ["facebook", "Facebook", ""],
                  ] as [string, string, string][]).map(([k, label, cls]) => (
                    <div key={k} className={cls}>
                      <label className="text-xs text-gray-500">{label}</label>
                      <input value={manualForm[k]} onChange={e => setManualForm({ ...manualForm, [k]: e.target.value })}
                        className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Notas</label>
                    <textarea value={manualForm.notas} onChange={e => setManualForm({ ...manualForm, notas: e.target.value })} rows={2}
                      className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none resize-none" />
                  </div>
                  {manualError && <p className="col-span-2 text-sm text-red-500">{manualError}</p>}
                </div>
                <div className="flex justify-end gap-2 p-5 border-t sticky bottom-0 bg-white">
                  <button onClick={() => setManualOpen(false)} className="text-sm text-gray-500 px-4 py-2">Cancelar</button>
                  <button onClick={guardarManual} disabled={manualSaving}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
                    {manualSaving ? "Guardando..." : "Guardar contacto"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filtros de la lista: buscador + rubro + zona + solo con contacto */}
          {prospectos.length > 0 && (() => {
            const rubrosDisponibles = Array.from(new Set(prospectos.map(p => p.rubro).filter(Boolean))) as string[];
            const zonasDisponibles = Array.from(new Set(prospectos.map(p => p.provincia).filter(Boolean))) as string[];
            return (
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={pTexto} onChange={e => setPTexto(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                {rubrosDisponibles.length > 1 && (
                  <select value={pRubroFiltro} onChange={e => setPRubroFiltro(e.target.value)}
                    className="border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="">Todos los rubros</option>
                    {rubrosDisponibles.sort().map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
                {zonasDisponibles.length > 1 && (
                  <select value={pZonaFiltro} onChange={e => setPZonaFiltro(e.target.value)}
                    className="border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="">Todas las zonas</option>
                    {zonasDisponibles.sort().map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                )}
                <button onClick={() => setPSoloContacto(v => !v)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${pSoloContacto ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  Con teléfono
                </button>
              </div>
            );
          })()}

          {(() => {
            const q = pTexto.trim().toLowerCase();
            const filtrados = prospectos.filter(p =>
              (!q || p.nombre.toLowerCase().includes(q)) &&
              (!pRubroFiltro || p.rubro === pRubroFiltro) &&
              (!pZonaFiltro || p.provincia === pZonaFiltro) &&
              (!pSoloContacto || !!p.telefono)
            );

          return pLoading ? (
            <p className="text-gray-400 text-sm">Cargando prospectos...</p>
          ) : prospectos.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Store size={40} strokeWidth={1} className="mx-auto mb-3" />
              <p className="mb-2">Todavía no buscaste comercios.</p>
              <p className="text-xs max-w-sm mx-auto">Escribí una provincia arriba y hacé clic en Buscar para traer revendedores potenciales.</p>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Ningún prospecto coincide con los filtros.</p>
              <button onClick={() => { setPTexto(""); setPRubroFiltro(""); setPZonaFiltro(""); setPSoloContacto(false); }}
                className="text-xs text-emerald-600 hover:underline mt-2">Limpiar filtros</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 mb-1">{filtrados.length} de {prospectos.length} prospectos</p>
              {[...filtrados].sort((a, b) => prioridadProspecto(b) - prioridadProspecto(a)).map((p) => (
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

                      {/* Mensaje de abordaje IA */}
                      <div className="mt-3">
                        {p.mensaje_abordaje ? (
                          <button onClick={() => setMsgAbierto(msgAbierto === p.id ? null : p.id)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                            {msgAbierto === p.id ? "Ocultar mensaje" : "Ver mensaje de abordaje"}
                          </button>
                        ) : (
                          <button onClick={() => generarAbordaje(p)} disabled={generandoMsg !== null}
                            className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium disabled:opacity-50">
                            {generandoMsg === p.id
                              ? <><RefreshCw size={11} className="animate-spin" /> Generando...</>
                              : <>✨ Generar mensaje de abordaje</>}
                          </button>
                        )}
                        {msgAbierto === p.id && p.mensaje_abordaje && (
                          <div className="mt-2 bg-purple-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
                            {p.mensaje_abordaje}
                            <div className="flex items-center gap-3 mt-3 flex-wrap">
                              <button onClick={() => navigator.clipboard.writeText(p.mensaje_abordaje!)}
                                className="text-xs text-purple-600 hover:underline">Copiar texto</button>
                              <button onClick={() => generarAbordaje(p)} disabled={generandoMsg !== null}
                                className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50">
                                {generandoMsg === p.id ? "Generando..." : "Regenerar"}
                              </button>
                              {p.telefono && (
                                <a href={waLink(p.telefono, p.mensaje_abordaje)} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
                                  <MessageCircle size={12} fill="white" strokeWidth={0} /> Enviar por WhatsApp
                                </a>
                              )}
                            </div>
                          </div>
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
          );
          })()}
        </>
      )}

    </div>
  );
}
