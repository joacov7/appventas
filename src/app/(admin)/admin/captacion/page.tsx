"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Users, RefreshCw, Plus, Trash2, X, MessageCircle, Search, Store, Phone, Globe, Instagram, Facebook, ExternalLink, MapPin, Clock, BarChart2 } from "lucide-react";

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
  puntaje: string | null;
  puntos: number | null;
  creado_en: string;
};

function hora(s: string) {
  return new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const PUNTAJE_STYLE: Record<string, string> = {
  A: "bg-emerald-600 text-white",
  B: "bg-amber-400 text-amber-950",
  C: "bg-gray-200 text-gray-500",
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
  const [pPuntajeFiltro, setPPuntajeFiltro] = useState("");

  // Paginado: trae de a PAGINA filas; "Cargar más" apila la siguiente tanda.
  const PAGINA = 200;
  const [pHayMas, setPHayMas] = useState(false);
  const [pCargandoMas, setPCargandoMas] = useState(false);

  async function fetchProspectos(estado?: string, offset = 0) {
    if (offset === 0) setPLoading(true); else setPCargandoMas(true);
    const params = new URLSearchParams({ limit: String(PAGINA), offset: String(offset) });
    if (estado) params.set("estado", estado);
    const res = await fetch(`/api/captacion/prospectos?${params}`);
    if (res.ok) {
      const data: Prospecto[] = await res.json();
      setProspectos(prev => offset === 0 ? data : [...prev, ...data]);
      setPHayMas(data.length === PAGINA);
    }
    if (offset === 0) setPLoading(false); else setPCargandoMas(false);
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

  // Búsqueda con Google Places (trae teléfono/web que OSM no siempre tiene).
  const [gBuscando, setGBuscando] = useState(false);
  async function buscarPlaces() {
    if (!pZona.trim()) { setPMsg("Escribí una provincia o ciudad"); return; }
    if (!pRubros.length) { setPMsg("Elegí al menos un rubro"); return; }
    setGBuscando(true); setPMsg("");
    try {
      const res = await fetch("/api/captacion/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zona: pZona.trim(), pais: pPais.trim() || "Argentina", rubros: pRubros }),
      });
      const data = await res.json();
      if (!res.ok) { setPMsg(data.error ?? "Error en la búsqueda"); return; }
      if (data.total === 0) { setPMsg(data.error ?? "Sin resultados"); return; }
      setPMsg(`Google: ${data.total} negocios (${data.con_telefono} con teléfono) en ${pZona.trim()}.`);
      fetchProspectos(pFiltro || undefined);
    } catch {
      setPMsg("Error de conexión");
    } finally { setGBuscando(false); cargarPresupuesto(); }
  }

  // Presupuesto de Google Places (gasto del mes y límite).
  const [presu, setPresu] = useState<{ limite_usd: number; gasto_usd: number; requests: number } | null>(null);
  async function cargarPresupuesto() {
    try {
      const r = await fetch("/api/captacion/places/presupuesto");
      if (r.ok) setPresu(await r.json());
    } catch { /* sin red: se oculta la línea */ }
  }
  useEffect(() => { cargarPresupuesto(); }, []);

  async function cambiarLimite() {
    const v = prompt("Límite mensual de gasto en Google Places (USD):", String(presu?.limite_usd ?? 10));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { alert("Poné un número válido"); return; }
    const r = await fetch("/api/captacion/places/presupuesto", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limite_usd: n }),
    });
    if (r.ok) setPresu(await r.json());
  }

  // Barrido por provincia: recorre ciudad por ciudad con la fuente OSM (gratis).
  const [barrido, setBarrido] = useState<{ total: number; hecho: number; encontrados: number; ciudad: string } | null>(null);
  const barridoCancelado = useRef(false);

  async function barrerProvincia() {
    if (!pZona.trim()) { setPMsg("Escribí una provincia para barrer"); return; }
    if (!pRubros.length) { setPMsg("Elegí al menos un rubro"); return; }
    setPMsg("");
    const r = await fetch(`/api/captacion/ciudades?zona=${encodeURIComponent(pZona.trim())}&pais=${encodeURIComponent(pPais.trim() || "Argentina")}`);
    const d = await r.json();
    if (!r.ok || !d.ok || !d.ciudades?.length) { setPMsg(d.error ?? "No encontré ciudades en esa zona."); return; }
    if (!confirm(`Voy a recorrer ${d.total} ciudades/pueblos de ${pZona.trim()} con OpenStreetMap (gratis). Puede tardar varios minutos y podés cancelar cuando quieras. ¿Arranco?`)) return;

    barridoCancelado.current = false;
    let encontrados = 0, hecho = 0;
    for (const c of d.ciudades) {
      if (barridoCancelado.current) break;
      setBarrido({ total: d.total, hecho, encontrados, ciudad: c.nombre });
      try {
        // Incluimos la provincia como contexto para desambiguar ciudades
        // homónimas (ej: "Colón" hay en varias provincias).
        const zonaCiudad = `${c.nombre}, ${pZona.trim()}`;
        const res = await fetch("/api/captacion/prospectos", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zona: zonaCiudad, pais: pPais.trim() || "Argentina", rubros: pRubros }),
        });
        const data = await res.json();
        if (res.ok && data.total) encontrados += Number(data.total) || 0;
      } catch { /* ciudad que falla no corta el barrido */ }
      hecho++;
    }
    setBarrido(null);
    // Puntuar lo nuevo antes de refrescar, para que los A queden arriba.
    await fetch("/api/captacion/puntuar", { method: "POST" }).catch(() => {});
    setPMsg(barridoCancelado.current
      ? `Barrido cancelado: ${encontrados} comercios guardados de ${hecho} ciudades recorridas.`
      : `Barrido completo: ${encontrados} comercios guardados recorriendo ${hecho} ciudades de ${pZona.trim()}.`);
    fetchProspectos(pFiltro || undefined);
  }

  // Depuración de duplicados (OSM ↔ Google) + normalización de teléfonos.
  const [depurando, setDepurando] = useState(false);
  const [dedupMsg, setDedupMsg] = useState("");
  async function depurarDuplicados() {
    setDepurando(true); setDedupMsg("");
    try {
      const res = await fetch("/api/captacion/dedup", { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setDedupMsg(d.error ?? "Error al depurar"); return; }
      const pj = d.puntajes ? ` · Puntajes: ${d.puntajes.A} A, ${d.puntajes.B} B, ${d.puntajes.C} C.` : "";
      setDedupMsg(`✅ ${d.total_fusionados} duplicado(s) fusionado(s) (${d.fusionados_por_telefono} por teléfono, ${d.fusionados_por_nombre_geo} por nombre+ubicación). ${d.telefonos_normalizados} teléfono(s) normalizado(s).${pj}`);
      fetchProspectos(pFiltro || undefined);
    } catch {
      setDedupMsg("Error de conexión");
    } finally { setDepurando(false); }
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

  // Enriquecimiento: buscar email/redes en el sitio web de cada prospecto.
  const [enriq, setEnriq] = useState<{ hechos: number; emails: number; restantes: number } | null>(null);
  const enriqCancelado = useRef(false);

  async function buscarEmails() {
    enriqCancelado.current = false;
    let hechos = 0, emails = 0;
    setEnriq({ hechos, emails, restantes: -1 });
    try {
      while (!enriqCancelado.current) {
        const r = await fetch("/api/captacion/enriquecer", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 10 }),
        });
        const d = await r.json();
        if (!r.ok) { setDedupMsg(d.error ?? "Error buscando emails"); break; }
        hechos += d.procesados; emails += d.con_email;
        setEnriq({ hechos, emails, restantes: d.restantes });
        if (!d.restantes || !d.procesados) break;
      }
      setDedupMsg(`📧 Revisé ${hechos} sitio(s): ${emails} email(es) encontrados.`);
      fetchProspectos(pFiltro || undefined);
      fetch("/api/captacion/puntuar", { method: "POST" }).catch(() => {});
    } finally { setEnriq(null); }
  }

  // ── Historial de interacciones ──
  type Interaccion = { id: number; tipo: string; canal: string | null; detalle: string | null; creado_en: string };
  const [histAbierto, setHistAbierto] = useState<number | null>(null);
  const [histItems, setHistItems] = useState<Interaccion[]>([]);
  const [histCargando, setHistCargando] = useState(false);
  const [notaNueva, setNotaNueva] = useState("");

  async function abrirHistorial(id: number) {
    if (histAbierto === id) { setHistAbierto(null); return; }
    setHistAbierto(id); setHistItems([]); setHistCargando(true); setNotaNueva("");
    const r = await fetch(`/api/captacion/prospectos/${id}/interacciones`);
    if (r.ok) setHistItems(await r.json());
    setHistCargando(false);
  }

  // Registra una interacción sin bloquear la acción principal.
  function logInteraccion(id: number, tipo: string, canal?: string, detalle?: string) {
    fetch(`/api/captacion/prospectos/${id}/interacciones`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, canal, detalle }),
    }).catch(() => {});
  }

  // Al abrir WhatsApp con un mensaje: queda registrado y el prospecto pasa a "contactado".
  function registrarEnvioWhatsapp(p: Prospecto, mensaje?: string | null) {
    logInteraccion(p.id, "contacto", "whatsapp", mensaje ?? undefined);
    if (p.estado === "nuevo") cambiarEstadoProspecto(p.id, "contactado");
  }

  async function agregarNota(id: number) {
    const detalle = notaNueva.trim();
    if (!detalle) return;
    setNotaNueva("");
    await fetch(`/api/captacion/prospectos/${id}/interacciones`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "nota", detalle }),
    });
    const r = await fetch(`/api/captacion/prospectos/${id}/interacciones`);
    if (r.ok) setHistItems(await r.json());
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
        <Link href="/admin/captacion/metricas"
          className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium">
          <BarChart2 size={15} /> Métricas
        </Link>
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
              <div className="flex items-end gap-2">
                <button onClick={buscarProspectos} disabled={pBuscando || gBuscando}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
                  title="Fuente OpenStreetMap (gratis)">
                  {pBuscando ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                  {pBuscando ? "Buscando..." : "Buscar (OSM)"}
                </button>
                <button onClick={buscarPlaces} disabled={pBuscando || gBuscando || !!barrido}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
                  title="Google Places: trae teléfono y web (tiene costo por búsqueda)">
                  {gBuscando ? <RefreshCw size={16} className="animate-spin" /> : <MapPin size={16} />}
                  {gBuscando ? "Buscando..." : "Google"}
                </button>
                <button onClick={barrerProvincia} disabled={pBuscando || gBuscando || !!barrido}
                  className="flex items-center gap-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 px-4 py-2.5 rounded-xl text-sm font-medium"
                  title="Recorre todas las ciudades de la provincia con OSM (gratis)">
                  <Store size={16} /> Barrer provincia
                </button>
              </div>
            </div>

            {/* Progreso del barrido */}
            {barrido && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Barriendo <b>{barrido.ciudad}</b> ({barrido.hecho + 1}/{barrido.total}) · {barrido.encontrados} comercios guardados</span>
                  <button onClick={() => { barridoCancelado.current = true; }} className="text-red-500 hover:underline">Cancelar</button>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(barrido.hecho / barrido.total) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Gasto de Google Places del mes */}
            {presu && (
              <p className="text-xs text-gray-400 mb-1">
                Google Places este mes: <b className={presu.gasto_usd >= presu.limite_usd ? "text-red-500" : "text-gray-600"}>~US${presu.gasto_usd}</b> de US${presu.limite_usd} ({presu.requests} búsquedas) ·{" "}
                <button onClick={cambiarLimite} className="text-indigo-500 hover:underline">cambiar límite</button>
              </p>
            )}
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
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {enriq ? (
                <span className="text-xs text-gray-500 flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin" />
                  Buscando emails... {enriq.hechos} sitios, {enriq.emails} emails{enriq.restantes >= 0 ? ` · faltan ${enriq.restantes}` : ""}
                  <button onClick={() => { enriqCancelado.current = true; }} className="text-red-500 hover:underline">Cancelar</button>
                </span>
              ) : (
                <button onClick={buscarEmails} disabled={depurando}
                  className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg"
                  title="Visita el sitio web de cada prospecto y extrae el email y las redes">
                  📧 Buscar emails
                </button>
              )}
              <button onClick={depurarDuplicados} disabled={depurando || !!enriq}
                className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg"
                title="Fusiona el mismo negocio que entró por OSM y por Google, y normaliza teléfonos">
                <RefreshCw size={15} className={depurando ? "animate-spin" : ""} /> {depurando ? "Depurando..." : "Depurar duplicados"}
              </button>
              <button onClick={() => { setManualOpen(true); setManualError(""); }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg">
                <Plus size={15} /> Cargar contacto
              </button>
            </div>
          </div>
          {dedupMsg && <p className="text-sm text-emerald-600 mb-3">{dedupMsg}</p>}

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
                {["A", "B", "C"].map(l => (
                  <button key={l} onClick={() => setPPuntajeFiltro(v => v === l ? "" : l)}
                    title={l === "A" ? "Los mejores: rubro afín y contactables" : l === "B" ? "Valen la pena" : "Baja prioridad"}
                    className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${pPuntajeFiltro === l ? PUNTAJE_STYLE[l] : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                    {l}
                  </button>
                ))}
              </div>
            );
          })()}

          {(() => {
            const q = pTexto.trim().toLowerCase();
            const filtrados = prospectos.filter(p =>
              (!q || p.nombre.toLowerCase().includes(q)) &&
              (!pRubroFiltro || p.rubro === pRubroFiltro) &&
              (!pZonaFiltro || p.provincia === pZonaFiltro) &&
              (!pSoloContacto || !!p.telefono) &&
              (!pPuntajeFiltro || p.puntaje === pPuntajeFiltro)
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
              {[...filtrados].sort((a, b) => (b.puntos ?? prioridadProspecto(b)) - (a.puntos ?? prioridadProspecto(a))).map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.puntaje && (
                          <span title={`${p.puntos ?? 0} puntos`}
                            className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${PUNTAJE_STYLE[p.puntaje] ?? "bg-gray-100 text-gray-400"}`}>
                            {p.puntaje}
                          </span>
                        )}
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
                              onClick={() => registrarEnvioWhatsapp(p)}
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

                      {/* Mensaje de abordaje IA + historial */}
                      <div className="mt-3 flex items-center gap-4 flex-wrap">
                        <button onClick={() => abrirHistorial(p.id)}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 font-medium">
                          <Clock size={11} /> {histAbierto === p.id ? "Ocultar historial" : "Historial"}
                        </button>
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
                          <div className="w-full mt-1 bg-purple-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
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
                                  onClick={() => registrarEnvioWhatsapp(p, p.mensaje_abordaje)}
                                  className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
                                  <MessageCircle size={12} fill="white" strokeWidth={0} /> Enviar por WhatsApp
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Panel de historial */}
                        {histAbierto === p.id && (
                          <div className="w-full mt-1 bg-gray-50 rounded-xl p-3">
                            {histCargando ? (
                              <p className="text-xs text-gray-400">Cargando historial...</p>
                            ) : histItems.length === 0 ? (
                              <p className="text-xs text-gray-400">Sin interacciones todavía. Cuando le mandes un WhatsApp o cambies su estado, queda registrado acá.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {histItems.map(h => (
                                  <div key={h.id} className="text-xs text-gray-600 flex items-start gap-2">
                                    <span className="text-gray-400 shrink-0 w-24">{hora(h.creado_en)}</span>
                                    <span className="font-medium shrink-0 capitalize">{h.tipo}{h.canal ? ` · ${h.canal}` : ""}</span>
                                    <span className="text-gray-500 break-words min-w-0">{h.detalle ?? ""}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <input value={notaNueva} onChange={e => setNotaNueva(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && agregarNota(p.id)}
                                placeholder="Agregar una nota..."
                                className="flex-1 text-xs border rounded-lg px-2 py-1.5 outline-none bg-white" />
                              <button onClick={() => agregarNota(p.id)} disabled={!notaNueva.trim()}
                                className="text-xs bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg">Guardar</button>
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
              {pHayMas && (
                <div className="text-center pt-2">
                  <button onClick={() => fetchProspectos(pFiltro || undefined, prospectos.length)} disabled={pCargandoMas}
                    className="border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-600 text-sm font-medium px-5 py-2 rounded-xl">
                    {pCargandoMas ? "Cargando..." : `Cargar más (mostrando ${prospectos.length})`}
                  </button>
                </div>
              )}
            </div>
          );
          })()}
        </>
      )}

    </div>
  );
}
