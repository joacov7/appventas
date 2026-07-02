"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Megaphone, Plus, Pencil, Trash2, X, Check, Search, ChevronDown, ChevronUp,
  BarChart2, Users, MousePointerClick, Eye, DollarSign, TrendingUp, MessageCircle,
  ShoppingCart, Target, Zap, Image as ImageIcon, Video, LayoutGrid, Sparkles,
  Loader2, Copy, Download, Upload, Tag, ArrowUpRight, AlertCircle, RefreshCw,
  FileText, Globe, Instagram, Facebook,
} from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";
import { GeneradorCampana } from "./GeneradorCampana";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Campana {
  id: number;
  nombre: string;
  estado: "borrador" | "activa" | "pausada" | "finalizada";
  objetivo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  presupuesto_diario: number | null;
  presupuesto_total: number | null;
  notas: string | null;
  creado_en: string;
  total_invertido: number;
  total_leads: number;
  total_ventas: number;
  total_clics: number;
  total_impresiones: number;
  total_ingresos: number;
}

interface Conjunto {
  id: number;
  campana_id: number;
  nombre: string;
  pais: string;
  provincia: string | null;
  ciudad: string | null;
  edad_min: number;
  edad_max: number;
  sexo: string;
  idiomas: string[];
  intereses: string[];
  presupuesto_diario: number | null;
  anuncios: Anuncio[];
}

interface Anuncio {
  id: number;
  conjunto_id: number;
  campana_id: number;
  nombre: string;
  formato: "imagen" | "video" | "carrusel";
  imagenes: string[];
  video_url: string | null;
  texto_principal: string | null;
  titulo: string | null;
  descripcion: string | null;
  cta: string;
  url_destino: string | null;
  whatsapp: string | null;
  activo: boolean;
}

interface Lead {
  id: number;
  campana_id: number | null;
  campana_nombre: string | null;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  pais: string;
  fuente: string;
  estado: string;
  valor_estimado: number | null;
  notas: string | null;
  creado_en: string;
}

interface Medio {
  id: number;
  nombre: string;
  tipo: string;
  url: string;
  etiquetas: string[];
  creado_en: string;
}

interface Metricas {
  invertido: number;
  alcance: number;
  impresiones: number;
  clics: number;
  conversaciones: number;
  leads: number;
  ventas: number;
  ingresos: number;
}

interface DailyMetric {
  fecha: string;
  invertido: number;
  leads: number;
  clics: number;
  ventas: number;
  ingresos: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTADOS_CAMPANA = ["borrador", "activa", "pausada", "finalizada"] as const;
const OBJETIVOS = [
  { value: "ventas", label: "Ventas", icon: ShoppingCart },
  { value: "mensajes_wa", label: "Mensajes WhatsApp", icon: MessageCircle },
  { value: "mensajes_ig", label: "Mensajes Instagram", icon: Instagram },
  { value: "trafico", label: "Tráfico Web", icon: Globe },
  { value: "conversiones", label: "Conversiones", icon: Target },
  { value: "reconocimiento", label: "Reconocimiento", icon: Eye },
  { value: "mayoristas", label: "Captación Mayoristas", icon: Users },
];
const ESTADOS_LEAD = ["nuevo", "contactado", "calificado", "cliente", "descartado"];
const CTA_OPTIONS = ["LEARN_MORE","SHOP_NOW","CONTACT_US","SEND_MESSAGE","SUBSCRIBE","BOOK_NOW","SIGN_UP","DOWNLOAD"];

const estadoColor: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-600",
  activa: "bg-emerald-100 text-emerald-700",
  pausada: "bg-yellow-100 text-yellow-700",
  finalizada: "bg-blue-100 text-blue-700",
  nuevo: "bg-blue-100 text-blue-700",
  contactado: "bg-yellow-100 text-yellow-700",
  calificado: "bg-purple-100 text-purple-700",
  cliente: "bg-emerald-100 text-emerald-700",
  descartado: "bg-gray-100 text-gray-500",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}
function fmtN(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR").format(n);
}
function calcCPC(invertido: number, clics: number) {
  if (!clics) return "—";
  return fmt(invertido / clics);
}
function calcCPL(invertido: number, leads: number) {
  if (!leads) return "—";
  return fmt(invertido / leads);
}
function calcROAS(ingresos: number, invertido: number) {
  if (!invertido) return "—";
  return (ingresos / invertido).toFixed(2) + "x";
}
function calcCTR(clics: number, impresiones: number) {
  if (!impresiones) return "—";
  return ((clics / impresiones) * 100).toFixed(2) + "%";
}
function calcCPM(invertido: number, impresiones: number) {
  if (!impresiones) return "—";
  return fmt((invertido / impresiones) * 1000);
}

// ─── Mini chart ───────────────────────────────────────────────────────────────
function MiniChart({ data, field, color = "#10b981" }: { data: DailyMetric[]; field: keyof DailyMetric; color?: string }) {
  if (!data.length) return <div className="h-12 flex items-center justify-center text-gray-300 text-xs">Sin datos</div>;
  const vals = data.map(d => Number(d[field]) || 0);
  const max = Math.max(...vals, 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {vals.slice(-14).map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all" style={{ height: `${(v / max) * 100}%`, background: color, opacity: 0.7 + (i / vals.length) * 0.3 }} title={String(v)} />
      ))}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, color = "emerald", chart, chartField, chartData }:
  { label: string; value: string; sub?: string; icon: any; color?: string; chart?: boolean; chartField?: keyof DailyMetric; chartData?: DailyMetric[] }) {
  const colors: Record<string, string> = { emerald: "text-emerald-600 bg-emerald-50", blue: "text-blue-600 bg-blue-50", purple: "text-purple-600 bg-purple-50", orange: "text-orange-600 bg-orange-50", rose: "text-rose-600 bg-rose-50", teal: "text-teal-600 bg-teal-50" };
  const chartColors: Record<string, string> = { emerald: "#10b981", blue: "#3b82f6", purple: "#8b5cf6", orange: "#f97316", rose: "#f43f5e", teal: "#14b8a6" };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className={`p-1.5 rounded-lg ${colors[color]}`}><Icon size={14} /></span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {chart && chartField && chartData && (
        <MiniChart data={chartData} field={chartField} color={chartColors[color]} />
      )}
    </div>
  );
}

// ─── Campaign Modal ───────────────────────────────────────────────────────────
function CampanaModal({ initial, onSave, onClose }: { initial?: Partial<Campana>; onSave: (data: any) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? "",
    estado: initial?.estado ?? "borrador",
    objetivo: initial?.objetivo ?? "ventas",
    fecha_inicio: initial?.fecha_inicio?.split("T")[0] ?? "",
    fecha_fin: initial?.fecha_fin?.split("T")[0] ?? "",
    presupuesto_diario: initial?.presupuesto_diario?.toString() ?? "",
    presupuesto_total: initial?.presupuesto_total?.toString() ?? "",
    notas: initial?.notas ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      presupuesto_diario: form.presupuesto_diario ? Number(form.presupuesto_diario) : null,
      presupuesto_total: form.presupuesto_total ? Number(form.presupuesto_total) : null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <h2 className="font-bold text-gray-900">{initial?.id ? "Editar campaña" : "Nueva campaña"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nombre *</label>
            <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ej: Mates Navidad 2025" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as any }))}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none">
                {ESTADOS_CAMPANA.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Objetivo</label>
              <select value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none">
                {OBJETIVOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Presupuesto diario ($)</label>
              <input type="number" min="0" value={form.presupuesto_diario} onChange={e => setForm(f => ({ ...f, presupuesto_diario: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Presupuesto total ($)</label>
              <input type="number" min="0" value={form.presupuesto_total} onChange={e => setForm(f => ({ ...f, presupuesto_total: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="15000" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2 text-sm font-medium">
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : initial?.id ? "Guardar" : "Crear campaña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ad Preview ───────────────────────────────────────────────────────────────
function AdPreview({ anuncio }: { anuncio: Partial<Anuncio> }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white max-w-xs mx-auto shadow-sm">
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
          <Facebook size={14} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900">Tu Página</p>
          <p className="text-xs text-gray-400">Publicidad · 🌐</p>
        </div>
      </div>
      {anuncio.texto_principal && (
        <p className="px-3 py-2 text-xs text-gray-700 leading-relaxed">{anuncio.texto_principal}</p>
      )}
      {anuncio.imagenes?.[0] ? (
        <img src={anuncio.imagenes[0]} alt="" className="w-full aspect-square object-cover" />
      ) : (
        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-300">
          <ImageIcon size={40} />
        </div>
      )}
      <div className="p-3 border-t bg-gray-50">
        {anuncio.titulo && <p className="text-xs font-bold text-gray-900">{anuncio.titulo}</p>}
        {anuncio.descripcion && <p className="text-xs text-gray-500 mt-0.5">{anuncio.descripcion}</p>}
        {anuncio.url_destino && <p className="text-xs text-gray-400 mt-0.5 truncate">{anuncio.url_destino}</p>}
        <div className="mt-2">
          <span className="text-xs font-semibold text-blue-600 border border-blue-200 px-2 py-1 rounded">
            {anuncio.cta?.replace(/_/g, " ") ?? "LEARN MORE"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Conjunto Form ────────────────────────────────────────────────────────────
function ConjuntoForm({ campana_id, onSave, onClose }: { campana_id: number; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ nombre: "", pais: "AR", provincia: "", ciudad: "", edad_min: "18", edad_max: "65", sexo: "todos", intereses: "", presupuesto_diario: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/meta/conjuntos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campana_id,
        nombre: form.nombre,
        pais: form.pais,
        provincia: form.provincia || null,
        ciudad: form.ciudad || null,
        edad_min: Number(form.edad_min),
        edad_max: Number(form.edad_max),
        sexo: form.sexo,
        intereses: form.intereses.split(",").map(s => s.trim()).filter(Boolean),
        presupuesto_diario: form.presupuesto_diario ? Number(form.presupuesto_diario) : null,
      }),
    });
    setSaving(false);
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50">
      <h4 className="text-sm font-semibold text-gray-700">Nuevo conjunto de anuncios</h4>
      <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
        placeholder="Nombre del conjunto" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
      <div className="grid grid-cols-3 gap-2">
        <input value={form.pais} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} placeholder="País" className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
        <input value={form.provincia} onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))} placeholder="Provincia" className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
        <input value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} placeholder="Ciudad" className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="number" value={form.edad_min} onChange={e => setForm(f => ({ ...f, edad_min: e.target.value }))} placeholder="Edad mín" className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
        <input type="number" value={form.edad_max} onChange={e => setForm(f => ({ ...f, edad_max: e.target.value }))} placeholder="Edad máx" className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
        <select value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))} className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white">
          <option value="todos">Todos</option>
          <option value="hombres">Hombres</option>
          <option value="mujeres">Mujeres</option>
        </select>
      </div>
      <input value={form.intereses} onChange={e => setForm(f => ({ ...f, intereses: e.target.value }))}
        placeholder="Intereses (separados por coma): mate, yerba, cultura argentina..." className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
      <input type="number" value={form.presupuesto_diario} onChange={e => setForm(f => ({ ...f, presupuesto_diario: e.target.value }))}
        placeholder="Presupuesto diario ($)" className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 text-xs border rounded-lg py-1.5 text-gray-600 hover:bg-white">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-1 text-xs bg-emerald-600 text-white rounded-lg py-1.5 font-medium disabled:opacity-50">
          {saving ? "Guardando..." : "Crear conjunto"}
        </button>
      </div>
    </form>
  );
}

// ─── Anuncio Form ─────────────────────────────────────────────────────────────
function AnuncioForm({ conjunto_id, campana_id, onSave, onClose }: { conjunto_id: number; campana_id: number; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ nombre: "", formato: "imagen" as "imagen"|"video"|"carrusel", imagenes: [] as string[], video_url: "", texto_principal: "", titulo: "", descripcion: "", cta: "LEARN_MORE", url_destino: "", whatsapp: "", instagram: "", facebook: "" });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/meta/anuncios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, conjunto_id, campana_id }),
    });
    setSaving(false);
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-dashed border-blue-200 rounded-xl bg-blue-50/30">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Nuevo anuncio</h4>
        <button type="button" onClick={() => setShowPreview(p => !p)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          <Eye size={12} /> {showPreview ? "Ocultar" : "Vista previa"}
        </button>
      </div>
      {showPreview && <AdPreview anuncio={form} />}
      <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
        placeholder="Nombre del anuncio" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
      <div className="flex gap-2">
        {(["imagen","video","carrusel"] as const).map(t => (
          <button key={t} type="button" onClick={() => setForm(f => ({ ...f, formato: t }))}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.formato === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 bg-white"}`}>
            {t === "imagen" ? <ImageIcon size={12} /> : t === "video" ? <Video size={12} /> : <LayoutGrid size={12} />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {(form.formato === "imagen" || form.formato === "carrusel") && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Imágenes</label>
          <MediaUpload urls={form.imagenes} onChange={urls => setForm(f => ({ ...f, imagenes: urls }))} />
        </div>
      )}
      {form.formato === "video" && (
        <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
          placeholder="URL del video" className="w-full border rounded-lg px-3 py-2 text-sm outline-none bg-white" />
      )}
      <textarea value={form.texto_principal} onChange={e => setForm(f => ({ ...f, texto_principal: e.target.value }))}
        rows={3} placeholder="Texto principal del anuncio..." className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none" />
      <div className="grid grid-cols-2 gap-2">
        <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          placeholder="Título" className="border rounded-lg px-3 py-2 text-sm outline-none bg-white" />
        <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          placeholder="Descripción" className="border rounded-lg px-3 py-2 text-sm outline-none bg-white" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={form.cta} onChange={e => setForm(f => ({ ...f, cta: e.target.value }))}
          className="border rounded-lg px-2 py-2 text-sm outline-none bg-white">
          {CTA_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select>
        <input value={form.url_destino} onChange={e => setForm(f => ({ ...f, url_destino: e.target.value }))}
          placeholder="URL destino" className="border rounded-lg px-3 py-2 text-sm outline-none bg-white" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
          placeholder="WhatsApp" className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
        <input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
          placeholder="Instagram" className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
        <input value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))}
          placeholder="Facebook" className="border rounded-lg px-2 py-1.5 text-xs outline-none bg-white" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 text-xs border rounded-lg py-1.5 text-gray-600 hover:bg-white">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-1 text-xs bg-blue-600 text-white rounded-lg py-1.5 font-medium disabled:opacity-50">
          {saving ? "Guardando..." : "Crear anuncio"}
        </button>
      </div>
    </form>
  );
}

// ─── Campaign Detail ──────────────────────────────────────────────────────────
function CampanaDetail({ campana, onClose, onUpdated }: { campana: Campana; onClose: () => void; onUpdated: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showConjuntoForm, setShowConjuntoForm] = useState(false);
  const [showAnuncioFor, setShowAnuncioFor] = useState<number | null>(null);
  const [metricsForm, setMetricsForm] = useState({ fecha: new Date().toISOString().split("T")[0], invertido: "", alcance: "", impresiones: "", clics: "", conversaciones: "", leads: "", ventas: "", ingresos: "" });
  const [savingMetrics, setSavingMetrics] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/meta/campanas/${campana.id}`);
    setDetail(await res.json());
    setLoading(false);
  }, [campana.id]);

  useEffect(() => { load(); }, [load]);

  async function saveMetrics(e: React.FormEvent) {
    e.preventDefault();
    setSavingMetrics(true);
    await fetch("/api/meta/metricas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campana_id: campana.id, ...metricsForm }),
    });
    setSavingMetrics(false);
    await load();
    onUpdated();
  }

  async function deleteConjunto(id: number) {
    if (!confirm("¿Eliminar este conjunto y todos sus anuncios?")) return;
    await fetch("/api/meta/conjuntos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  async function deleteAnuncio(id: number) {
    if (!confirm("¿Eliminar este anuncio?")) return;
    await fetch("/api/meta/anuncios", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b sticky top-0 bg-white z-10">
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900 text-sm">{campana.nombre}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor[campana.estado]}`}>{campana.estado}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Invertido", val: fmt(campana.total_invertido) },
                { label: "Leads", val: fmtN(campana.total_leads) },
                { label: "Ventas", val: fmtN(campana.total_ventas) },
                { label: "ROAS", val: calcROAS(campana.total_ingresos, campana.total_invertido) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-bold text-gray-900 text-sm mt-0.5">{val}</p>
                </div>
              ))}
            </div>

            {/* Cargar métricas */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><BarChart2 size={14} className="text-emerald-600" /> Cargar métricas del día</h3>
              <form onSubmit={saveMetrics} className="grid grid-cols-3 gap-2">
                <input type="date" value={metricsForm.fecha} onChange={e => setMetricsForm(f => ({ ...f, fecha: e.target.value }))}
                  className="col-span-3 border rounded-lg px-3 py-2 text-xs outline-none" />
                {[["invertido","Invertido ($)"],["alcance","Alcance"],["impresiones","Impresiones"],["clics","Clics"],["conversaciones","Conversaciones"],["leads","Leads"],["ventas","Ventas"],["ingresos","Ingresos ($)"]].map(([k, lbl]) => (
                  <input key={k} type="number" min="0" value={(metricsForm as any)[k]} onChange={e => setMetricsForm(f => ({ ...f, [k]: e.target.value }))}
                    placeholder={lbl} className="border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-400" />
                ))}
                <button type="submit" disabled={savingMetrics} className="col-span-3 bg-emerald-600 text-white rounded-lg py-2 text-xs font-medium disabled:opacity-50">
                  {savingMetrics ? "Guardando..." : "Guardar métricas"}
                </button>
              </form>
            </div>

            {/* Mini chart */}
            {detail?.metricas?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Inversión últimos 14 días</h3>
                <MiniChart data={detail.metricas.slice().reverse()} field="invertido" color="#10b981" />
              </div>
            )}

            {/* Conjuntos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Users size={14} className="text-blue-600" /> Conjuntos de anuncios</h3>
                <button onClick={() => setShowConjuntoForm(true)} className="text-xs text-emerald-600 hover:underline flex items-center gap-1"><Plus size={12} />Agregar</button>
              </div>
              {showConjuntoForm && (
                <ConjuntoForm campana_id={campana.id} onSave={() => { setShowConjuntoForm(false); load(); }} onClose={() => setShowConjuntoForm(false)} />
              )}
              {(detail?.conjuntos ?? []).length === 0 && !showConjuntoForm && (
                <p className="text-xs text-gray-400 py-3 text-center">Sin conjuntos. Creá uno para empezar.</p>
              )}
              <div className="space-y-3">
                {(detail?.conjuntos ?? []).map((cs: Conjunto) => (
                  <div key={cs.id} className="border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{cs.nombre}</p>
                        <p className="text-xs text-gray-400">{cs.pais}{cs.provincia ? ` · ${cs.provincia}` : ""} · {cs.edad_min}–{cs.edad_max} años · {cs.sexo}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setShowAnuncioFor(cs.id)} className="text-xs text-blue-600 hover:underline px-2 py-1"><Plus size={12} className="inline" /> Anuncio</button>
                        <button onClick={() => deleteConjunto(cs.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {showAnuncioFor === cs.id && (
                      <div className="p-3">
                        <AnuncioForm conjunto_id={cs.id} campana_id={campana.id} onSave={() => { setShowAnuncioFor(null); load(); }} onClose={() => setShowAnuncioFor(null)} />
                      </div>
                    )}
                    {(cs.anuncios ?? []).length > 0 && (
                      <div className="divide-y">
                        {cs.anuncios.map((a: Anuncio) => (
                          <div key={a.id} className="flex items-center gap-3 px-4 py-2">
                            {a.imagenes?.[0] ? (
                              <img src={a.imagenes[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-300"><ImageIcon size={16} /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{a.nombre}</p>
                              <p className="text-xs text-gray-400">{a.formato} · {a.cta}</p>
                            </div>
                            <button onClick={() => deleteAnuncio(a.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── IA Panel ─────────────────────────────────────────────────────────────────
function IAPanel() {
  const TIPOS = [
    { key: "textos", label: "Textos publicitarios", icon: FileText },
    { key: "titulos", label: "Títulos", icon: Tag },
    { key: "descripciones", label: "Descripciones", icon: AlignLeft },
    { key: "cta", label: "Llamados a la acción", icon: MousePointerClick },
    { key: "ab", label: "Variantes A/B", icon: LayoutGrid },
    { key: "ideas_video", label: "Ideas de video", icon: Video },
    { key: "ideas_imagen", label: "Ideas de imagen", icon: ImageIcon },
    { key: "segmentacion", label: "Segmentaciones", icon: Users },
    { key: "presupuesto", label: "Presupuesto sugerido", icon: DollarSign },
  ];

  const [tipo, setTipo] = useState("textos");
  const [contexto, setContexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/meta/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, contexto }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  }

  function renderResult() {
    if (!result) return null;
    const entries = Object.entries(result);
    return (
      <div className="space-y-4 mt-4">
        {entries.map(([key, val]: [string, any]) => (
          <div key={key}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{key}</h4>
            {Array.isArray(val) ? (
              <div className="space-y-2">
                {val.map((item: any, i: number) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 relative group">
                    {typeof item === "string" ? (
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-700">{item}</p>
                        <button onClick={() => copy(item)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded shrink-0">
                          {copied === item ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-gray-400" />}
                        </button>
                      </div>
                    ) : (
                      <div>
                        {Object.entries(item).map(([k, v]: [string, any]) => (
                          <div key={k} className="mb-1">
                            <span className="text-xs font-medium text-gray-500">{k}: </span>
                            {Array.isArray(v) ? (
                              <span className="text-xs text-gray-700">{v.join(", ")}</span>
                            ) : (
                              <span className="text-sm text-gray-800">{String(v)}</span>
                            )}
                          </div>
                        ))}
                        <button onClick={() => copy(JSON.stringify(item, null, 2))} className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 hover:bg-gray-100 rounded">
                          {copied === JSON.stringify(item, null, 2) ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-gray-400" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-700 bg-white border rounded-xl p-3">{String(val)}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-purple-600" />
          <h3 className="font-semibold text-gray-900 text-sm">IA para Meta Ads</h3>
        </div>
        <p className="text-xs text-gray-500">Generá contenido publicitario optimizado para mates y accesorios.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TIPOS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTipo(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors text-left ${tipo === key ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:border-purple-300 bg-white"}`}>
            <Icon size={13} className="shrink-0" /> {label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-2xl p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Contexto / producto</label>
          <textarea value={contexto} onChange={e => setContexto(e.target.value)}
            rows={3} placeholder="Describí el producto, la oferta o el objetivo de la campaña. Ej: Mate artesanal de calabaza con grabado láser, ideal para regalo, precio $8.500..."
            className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Generando...</> : <><Sparkles size={15} /> Generar con IA</>}
        </button>
        {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
      </div>

      {result && renderResult()}
    </div>
  );
}

// Fake import for AlignLeft
function AlignLeft({ size }: { size: number }) {
  return <FileText size={size} />;
}

// ─── Biblioteca ───────────────────────────────────────────────────────────────
function Biblioteca() {
  const [medios, setMedios] = useState<Medio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [form, setForm] = useState({ nombre: "", tipo: "imagen", url: "", etiquetas: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const tipo = filtroTipo !== "todos" ? `?tipo=${filtroTipo}` : "";
    const data = await fetch(`/api/meta/medios${tipo}`).then(r => r.json());
    setMedios(Array.isArray(data) ? data : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filtroTipo]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/meta/medios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, etiquetas: form.etiquetas.split(",").map(s => s.trim()).filter(Boolean) }),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ nombre: "", tipo: "imagen", url: "", etiquetas: "" });
    load();
  }

  async function deleteMedio(id: number) {
    await fetch("/api/meta/medios", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setMedios(m => m.filter(x => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["todos","imagen","video","logo","creatividad"].map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroTipo === t ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium">
          <Plus size={13} /> Agregar
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre" className="border rounded-xl px-3 py-2 text-sm outline-none" />
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="border rounded-xl px-3 py-2 text-sm outline-none">
              {["imagen","video","logo","creatividad"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">URL o subir imagen</label>
            <MediaUpload urls={form.url ? [form.url] : []} onChange={urls => setForm(f => ({ ...f, url: urls[0] ?? "" }))} />
          </div>
          <input value={form.etiquetas} onChange={e => setForm(f => ({ ...f, etiquetas: e.target.value }))}
            placeholder="Etiquetas (separadas por coma): navidad, promo, mates..." className="w-full border rounded-xl px-3 py-2 text-sm outline-none" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-xl py-2 text-sm text-gray-600">Cancelar</button>
            <button type="submit" disabled={saving || !form.nombre || !form.url} className="flex-1 bg-emerald-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
              {saving ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="animate-spin" /></div>
      ) : medios.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><ImageIcon size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Sin elementos en la biblioteca</p></div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {medios.map(m => (
            <div key={m.id} className="group relative border rounded-xl overflow-hidden bg-white shadow-sm">
              {m.tipo === "video" ? (
                <div className="aspect-square bg-gray-900 flex items-center justify-center">
                  <Video size={32} className="text-gray-500" />
                </div>
              ) : (
                <img src={m.url} alt={m.nombre} className="aspect-square w-full object-cover" />
              )}
              <div className="p-2">
                <p className="text-xs font-medium text-gray-800 truncate">{m.nombre}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(m.etiquetas ?? []).slice(0, 2).map((t, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button onClick={() => navigator.clipboard.writeText(m.url)} className="p-1 bg-white rounded shadow hover:bg-gray-50"><Copy size={11} /></button>
                <button onClick={() => deleteMedio(m.id)} className="p-1 bg-white rounded shadow hover:bg-red-50 text-red-500"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reportes ─────────────────────────────────────────────────────────────────
function Reportes({ campanas }: { campanas: Campana[] }) {
  const sorted = [...campanas].sort((a, b) => b.total_ingresos - a.total_ingresos);
  const mejor = sorted[0];

  function exportCSV() {
    const header = ["Campaña","Estado","Invertido","Leads","Ventas","Ingresos","ROAS","CPC","CPL"];
    const rows = campanas.map(c => [
      c.nombre, c.estado,
      c.total_invertido, c.total_leads, c.total_ventas, c.total_ingresos,
      c.total_invertido ? (c.total_ingresos / c.total_invertido).toFixed(2) : 0,
      c.total_clics ? (c.total_invertido / c.total_clics).toFixed(2) : 0,
      c.total_leads ? (c.total_invertido / c.total_leads).toFixed(2) : 0,
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "meta-ads-reporte.csv";
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Resumen general</h3>
        <button onClick={exportCSV} className="flex items-center gap-1.5 border rounded-xl px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      {mejor && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-emerald-600 mb-1 flex items-center gap-1"><TrendingUp size={12} /> Campaña más rentable</p>
          <p className="font-bold text-gray-900">{mejor.nombre}</p>
          <div className="flex gap-4 mt-2 text-xs text-gray-600">
            <span>ROAS: <strong>{calcROAS(mejor.total_ingresos, mejor.total_invertido)}</strong></span>
            <span>Ingresos: <strong>{fmt(mejor.total_ingresos)}</strong></span>
            <span>Leads: <strong>{fmtN(mejor.total_leads)}</strong></span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Campaña","Estado","Invertido","Leads","Ventas","Ingresos","ROAS","CPL","CTR"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {campanas.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">Sin campañas</td></tr>
            )}
            {campanas.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[140px] truncate">{c.nombre}</td>
                <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${estadoColor[c.estado]}`}>{c.estado}</span></td>
                <td className="px-4 py-2.5 text-gray-700">{fmt(c.total_invertido)}</td>
                <td className="px-4 py-2.5 text-gray-700">{fmtN(c.total_leads)}</td>
                <td className="px-4 py-2.5 text-gray-700">{fmtN(c.total_ventas)}</td>
                <td className="px-4 py-2.5 text-emerald-700 font-medium">{fmt(c.total_ingresos)}</td>
                <td className="px-4 py-2.5 font-bold text-gray-900">{calcROAS(c.total_ingresos, c.total_invertido)}</td>
                <td className="px-4 py-2.5 text-gray-600">{calcCPL(c.total_invertido, c.total_leads)}</td>
                <td className="px-4 py-2.5 text-gray-600">{calcCTR(c.total_clics, c.total_impresiones)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Leads Panel ──────────────────────────────────────────────────────────────
function LeadsPanel({ campanas }: { campanas: Campana[] }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ campana_id: "", nombre: "", email: "", telefono: "", pais: "AR", fuente: "meta_ads", estado: "nuevo", valor_estimado: "", notas: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const url = filtroEstado ? `/api/meta/leads?estado=${filtroEstado}` : "/api/meta/leads";
    const data = await fetch(url).then(r => r.json());
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filtroEstado]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/meta/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, campana_id: form.campana_id || null, valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null }),
    });
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function changeEstado(id: number, estado: string) {
    await fetch("/api/meta/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, estado }) });
    setLeads(ls => ls.map(l => l.id === id ? { ...l, estado } : l));
  }

  const filtered = leads.filter(l =>
    [l.nombre, l.email, l.telefono].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead..."
            className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm outline-none" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm outline-none">
          <option value="">Todos los estados</option>
          {ESTADOS_LEAD.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14} /> Agregar lead
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border rounded-2xl p-4 grid grid-cols-2 gap-3">
          <select value={form.campana_id} onChange={e => setForm(f => ({ ...f, campana_id: e.target.value }))}
            className="col-span-2 border rounded-xl px-3 py-2 text-sm outline-none">
            <option value="">Sin campaña asignada</option>
            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {[["nombre","Nombre"],["email","Email"],["telefono","Teléfono"],["pais","País"]].map(([k,lbl]) => (
            <input key={k} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              placeholder={lbl} className="border rounded-xl px-3 py-2 text-sm outline-none" />
          ))}
          <select value={form.fuente} onChange={e => setForm(f => ({ ...f, fuente: e.target.value }))}
            className="border rounded-xl px-3 py-2 text-sm outline-none">
            {["meta_ads","instagram","facebook","whatsapp","organico"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
          </select>
          <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
            className="border rounded-xl px-3 py-2 text-sm outline-none">
            {ESTADOS_LEAD.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <input type="number" value={form.valor_estimado} onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
            placeholder="Valor estimado ($)" className="border rounded-xl px-3 py-2 text-sm outline-none" />
          <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            placeholder="Notas" className="border rounded-xl px-3 py-2 text-sm outline-none" />
          <div className="col-span-2 flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-xl py-2 text-sm text-gray-600">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar lead"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Nombre","Contacto","Fuente","Campaña","Estado","Valor","Fecha"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Sin leads</td></tr>}
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{l.nombre ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">
                  {l.email && <div>{l.email}</div>}
                  {l.telefono && <div>{l.telefono}</div>}
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{l.fuente?.replace("_"," ")}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[100px] truncate">{l.campana_nombre ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <select value={l.estado} onChange={e => changeEstado(l.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${estadoColor[l.estado]}`}>
                    {ESTADOS_LEAD.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-gray-700 text-xs">{fmt(l.valor_estimado)}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(l.creado_en).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MetaAdsPage() {
  const [tab, setTab] = useState<"dashboard"|"campanas"|"leads"|"biblioteca"|"ia"|"reportes">("dashboard");
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [periodoMetrica, setPeriodoMetrica] = useState("30");
  const [showModal, setShowModal] = useState(false);
  const [editCampana, setEditCampana] = useState<Campana | null>(null);
  const [detailCampana, setDetailCampana] = useState<Campana | null>(null);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  async function loadCampanas() {
    const data = await fetch("/api/meta/campanas").then(r => r.json());
    setCampanas(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function loadMetricas() {
    const data = await fetch(`/api/meta/metricas?periodo=${periodoMetrica}`).then(r => r.json());
    if (data.totals) { setMetricas(data.totals); setDaily(data.daily ?? []); }
  }

  useEffect(() => {
    loadCampanas();
    loadMetricas();
  }, [periodoMetrica]);

  async function handleSaveCampana(form: any) {
    if (editCampana?.id) {
      await fetch(`/api/meta/campanas/${editCampana.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/meta/campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowModal(false);
    setEditCampana(null);
    loadCampanas();
    loadMetricas();
  }

  async function deleteCampana(id: number) {
    if (!confirm("¿Eliminar esta campaña y todos sus datos?")) return;
    await fetch(`/api/meta/campanas/${id}`, { method: "DELETE" });
    setCampanas(cs => cs.filter(c => c.id !== id));
  }

  async function toggleEstado(c: Campana) {
    const next = c.estado === "activa" ? "pausada" : "activa";
    await fetch(`/api/meta/campanas/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: next }),
    });
    setCampanas(cs => cs.map(x => x.id === c.id ? { ...x, estado: next as any } : x));
  }

  const filtered = campanas.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) &&
    (!filtroEstado || c.estado === filtroEstado)
  );

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart2 },
    { id: "campanas", label: "Campañas", icon: Megaphone },
    { id: "leads", label: "Leads", icon: Users },
    { id: "biblioteca", label: "Biblioteca", icon: ImageIcon },
    { id: "ia", label: "IA", icon: Sparkles },
    { id: "reportes", label: "Reportes", icon: TrendingUp },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Facebook size={16} className="text-white" />
            </div>
            Campañas Meta Ads
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gestioná tus campañas de Facebook e Instagram</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadCampanas(); loadMetricas(); }} className="p-2 border rounded-xl hover:bg-gray-50 text-gray-500">
            <RefreshCw size={15} />
          </button>
          {tab === "campanas" && (
            <button onClick={() => { setEditCampana(null); setShowModal(true); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={15} /> Nueva campaña
            </button>
          )}
        </div>
      </div>

      {/* Generador IA */}
      <GeneradorCampana onCreada={() => loadCampanas()} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Últimos</h2>
            <select value={periodoMetrica} onChange={e => setPeriodoMetrica(e.target.value)}
              className="border rounded-xl px-3 py-1.5 text-sm outline-none">
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Invertido" value={fmt(metricas?.invertido)} icon={DollarSign} color="rose" chart chartField="invertido" chartData={daily} />
            <MetricCard label="Alcance" value={fmtN(metricas?.alcance)} icon={Eye} color="blue" />
            <MetricCard label="Impresiones" value={fmtN(metricas?.impresiones)} icon={BarChart2} color="teal" />
            <MetricCard label="Clics" value={fmtN(metricas?.clics)} icon={MousePointerClick} color="purple" chart chartField="clics" chartData={daily} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="CTR" value={calcCTR(metricas?.clics ?? 0, metricas?.impresiones ?? 0)} icon={ArrowUpRight} color="blue" />
            <MetricCard label="CPM" value={calcCPM(metricas?.invertido ?? 0, metricas?.impresiones ?? 0)} icon={DollarSign} color="orange" />
            <MetricCard label="CPC" value={calcCPC(metricas?.invertido ?? 0, metricas?.clics ?? 0)} icon={MousePointerClick} color="rose" />
            <MetricCard label="Conversaciones" value={fmtN(metricas?.conversaciones)} icon={MessageCircle} color="teal" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Leads" value={fmtN(metricas?.leads)} icon={Users} color="purple" chart chartField="leads" chartData={daily} sub={calcCPL(metricas?.invertido ?? 0, metricas?.leads ?? 0) + " por lead"} />
            <MetricCard label="Ventas" value={fmtN(metricas?.ventas)} icon={ShoppingCart} color="emerald" chart chartField="ventas" chartData={daily} />
            <MetricCard label="Ingresos" value={fmt(metricas?.ingresos)} icon={TrendingUp} color="emerald" chart chartField="ingresos" chartData={daily} />
            <MetricCard label="ROAS" value={calcROAS(metricas?.ingresos ?? 0, metricas?.invertido ?? 0)} icon={Target} color="emerald" sub="retorno sobre inversión" />
          </div>

          {/* Campañas activas */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Campañas activas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campanas.filter(c => c.estado === "activa").map(c => (
                <div key={c.id} className="bg-white border rounded-2xl p-4 space-y-2 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailCampana(c)}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 text-sm truncate">{c.nombre}</p>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">activa</span>
                  </div>
                  <p className="text-xs text-gray-400">{OBJETIVOS.find(o => o.value === c.objetivo)?.label ?? c.objetivo}</p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div><p className="text-xs text-gray-400">Invertido</p><p className="text-sm font-bold text-gray-900">{fmt(c.total_invertido)}</p></div>
                    <div><p className="text-xs text-gray-400">Leads</p><p className="text-sm font-bold text-gray-900">{fmtN(c.total_leads)}</p></div>
                    <div><p className="text-xs text-gray-400">ROAS</p><p className="text-sm font-bold text-emerald-700">{calcROAS(c.total_ingresos, c.total_invertido)}</p></div>
                  </div>
                </div>
              ))}
              {campanas.filter(c => c.estado === "activa").length === 0 && (
                <p className="text-sm text-gray-400 col-span-3 py-4">No hay campañas activas.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Campañas ── */}
      {tab === "campanas" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar campaña..."
                className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm outline-none" />
            </div>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm outline-none">
              <option value="">Todos los estados</option>
              {ESTADOS_CAMPANA.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <Megaphone size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin campañas. Creá la primera.</p>
                </div>
              )}
              {filtered.map(c => {
                const obj = OBJETIVOS.find(o => o.value === c.objetivo);
                return (
                  <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                        {obj ? <obj.icon size={18} className="text-white" /> : <Megaphone size={18} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{c.nombre}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor[c.estado]}`}>{c.estado}</span>
                          <span className="text-xs text-gray-400">{obj?.label ?? c.objetivo}</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          {c.fecha_inicio && <span>Inicio: {new Date(c.fecha_inicio).toLocaleDateString("es-AR")}</span>}
                          {c.presupuesto_diario && <span>Diario: {fmt(c.presupuesto_diario)}</span>}
                          {c.presupuesto_total && <span>Total: {fmt(c.presupuesto_total)}</span>}
                        </div>
                        <div className="flex gap-6 mt-3">
                          {[
                            ["Invertido", fmt(c.total_invertido)],
                            ["Leads", fmtN(c.total_leads)],
                            ["Ventas", fmtN(c.total_ventas)],
                            ["Ingresos", fmt(c.total_ingresos)],
                            ["ROAS", calcROAS(c.total_ingresos, c.total_invertido)],
                            ["CPL", calcCPL(c.total_invertido, c.total_leads)],
                          ].map(([lbl, val]) => (
                            <div key={lbl}>
                              <p className="text-xs text-gray-400">{lbl}</p>
                              <p className="text-sm font-bold text-gray-900">{val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setDetailCampana(c)} className="p-2 hover:bg-blue-50 rounded-xl text-blue-600 text-xs font-medium flex items-center gap-1">
                          <Eye size={13} /> Ver
                        </button>
                        <button onClick={() => toggleEstado(c)} className={`p-2 rounded-xl text-xs font-medium ${c.estado === "activa" ? "hover:bg-yellow-50 text-yellow-600" : "hover:bg-emerald-50 text-emerald-600"}`}>
                          {c.estado === "activa" ? "Pausar" : "Activar"}
                        </button>
                        <button onClick={() => { setEditCampana(c); setShowModal(true); }} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteCampana(c.id)} className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "leads" && <LeadsPanel campanas={campanas} />}
      {tab === "biblioteca" && <Biblioteca />}
      {tab === "ia" && <IAPanel />}
      {tab === "reportes" && <Reportes campanas={campanas} />}

      {/* Campaign Modal */}
      {showModal && (
        <CampanaModal
          initial={editCampana ?? undefined}
          onSave={handleSaveCampana}
          onClose={() => { setShowModal(false); setEditCampana(null); }}
        />
      )}

      {/* Campaign Detail Drawer */}
      {detailCampana && (
        <CampanaDetail
          campana={detailCampana}
          onClose={() => setDetailCampana(null)}
          onUpdated={() => { loadCampanas(); loadMetricas(); }}
        />
      )}
    </div>
  );
}
