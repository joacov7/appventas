"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Inbox, RefreshCw, Send, MessageCircle, Instagram, Facebook, ArrowLeft, Paperclip, UserPlus } from "lucide-react";

type Canal = "whatsapp" | "instagram" | "facebook";
type Segmento = "minorista" | "mayorista" | "empresarial";
interface Conversacion {
  canal: Canal; contacto: string; ultimo_texto: string; ultima_fecha: string;
  ultima_direccion: "entrante" | "saliente" | "error"; total: number; espera_respuesta: boolean;
  segmento?: Segmento | null;
}
interface Mensaje { direccion: "entrante" | "saliente" | "error"; texto: string; fecha: string; estado?: string | null }

// Tildes de entrega, estilo WhatsApp. sent = ✓, delivered/read = ✓✓ (read en azul).
function TildeEstado({ estado }: { estado?: string | null }) {
  if (estado === "failed") return <span title="No se pudo entregar" className="text-red-300">✕</span>;
  if (estado === "read") return <span title="Leído" className="text-sky-300">✓✓</span>;
  if (estado === "delivered") return <span title="Entregado">✓✓</span>;
  if (estado === "sent") return <span title="Enviado">✓</span>;
  return <span title="Enviando…" className="opacity-60">🕓</span>;
}

const CANAL_ICON: Record<Canal, any> = { whatsapp: MessageCircle, instagram: Instagram, facebook: Facebook };
const CANAL_COLOR: Record<Canal, string> = { whatsapp: "text-emerald-600", instagram: "text-pink-600", facebook: "text-blue-600" };

const SEG_LABEL: Record<Segmento, string> = { minorista: "🛍️ Minorista", mayorista: "📦 Mayorista", empresarial: "🏢 Empresa" };
const SEG_STYLE: Record<Segmento, string> = {
  minorista: "bg-gray-100 text-gray-600",
  mayorista: "bg-amber-100 text-amber-700",
  empresarial: "bg-indigo-100 text-indigo-700",
};

function hora(s: string) {
  return new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function BandejaPage() {
  const [convs, setConvs] = useState<Conversacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Conversacion | null>(null);
  const [hilo, setHilo] = useState<Mensaje[]>([]);
  const [cargandoHilo, setCargandoHilo] = useState(false);
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [altaCalidad, setAltaCalidad] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Agendar el contacto como prospecto en Captación.
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [agenda, setAgenda] = useState({ nombre: "", rubro: "", email: "", provincia: "", notas: "" });
  const [agendando, setAgendando] = useState(false);
  const [agendaMsg, setAgendaMsg] = useState("");

  const loadConvs = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/bandeja");
    if (r.ok) setConvs(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { loadConvs(); }, [loadConvs]);

  const abrir = useCallback(async (c: Conversacion) => {
    setSel(c); setHilo([]); setCargandoHilo(true);
    const r = await fetch(`/api/bandeja?canal=${c.canal}&contacto=${encodeURIComponent(c.contacto)}`);
    if (r.ok) setHilo(await r.json());
    setCargandoHilo(false);
    setTimeout(() => finRef.current?.scrollIntoView(), 100);
  }, []);

  // Refresco silencioso del hilo abierto: actualiza tildes y mensajes nuevos
  // sin spinner ni saltos de scroll.
  useEffect(() => {
    if (!sel) return;
    let vivo = true;
    async function refrescar() {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/bandeja?canal=${sel!.canal}&contacto=${encodeURIComponent(sel!.contacto)}`);
        if (r.ok && vivo) {
          const nuevo: Mensaje[] = await r.json();
          setHilo(prev => (JSON.stringify(prev) === JSON.stringify(nuevo) ? prev : nuevo));
        }
      } catch { /* silencioso */ }
    }
    const t = setInterval(refrescar, 5000);
    return () => { vivo = false; clearInterval(t); };
  }, [sel]);

  async function enviar() {
    if (!sel || !respuesta.trim()) return;
    setEnviando(true);
    const r = await fetch("/api/bandeja", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canal: sel.canal, contacto: sel.contacto, texto: respuesta.trim() }),
    });
    setEnviando(false);
    if (r.ok) {
      setHilo(prev => [...prev, { direccion: "saliente", texto: respuesta.trim(), fecha: new Date().toISOString() }]);
      setRespuesta("");
      setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } else {
      alert((await r.json()).error ?? "No se pudo enviar");
    }
  }

  // Sube una foto o PDF a Cloudinary y lo manda al cliente (texto = pie opcional).
  async function enviarAdjunto(file: File) {
    if (!sel) return;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) { alert("Cloudinary no configurado (falta cloud name / upload preset)."); return; }
    const esPdf = file.type === "application/pdf";
    // En "alta calidad" mandamos la imagen como archivo (documento): WhatsApp no
    // la recomprime y llega igual que el original.
    const comoDocumento = esPdf || altaCalidad;
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", preset);
      const resType = comoDocumento ? "auto" : "image";
      const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resType}/upload`, { method: "POST", body: form });
      const data = await up.json();
      if (!data.secure_url) { alert("No se pudo subir el archivo."); return; }
      const caption = respuesta.trim();
      const r = await fetch("/api/bandeja", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal: sel.canal, contacto: sel.contacto, mediaUrl: data.secure_url, mediaTipo: comoDocumento ? "document" : "image", texto: caption || undefined }),
      });
      if (r.ok) {
        const etiqueta = (comoDocumento ? "📄 Archivo enviado" : "📷 Foto enviada") + (caption ? `: ${caption}` : "");
        setHilo(prev => [...prev, { direccion: "saliente", texto: etiqueta, fecha: new Date().toISOString() }]);
        setRespuesta("");
        setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else {
        alert((await r.json()).error ?? "No se pudo enviar");
      }
    } catch { alert("Error al enviar el adjunto"); }
    finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function agendarProspecto() {
    if (!sel || !agenda.nombre.trim()) { setAgendaMsg("Poné al menos el nombre"); return; }
    setAgendando(true); setAgendaMsg("");
    const r = await fetch("/api/bandeja/agendar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacto: sel.contacto, ...agenda }),
    });
    setAgendando(false);
    if (r.ok) {
      setAgendaMsg("✅ Agendado en Captación");
      setAgenda({ nombre: "", rubro: "", email: "", provincia: "", notas: "" });
      setTimeout(() => { setAgendarOpen(false); setAgendaMsg(""); }, 1200);
    } else {
      setAgendaMsg((await r.json().catch(() => ({}))).error ?? "No se pudo agendar");
    }
  }

  async function cambiarSegmento(seg: Segmento) {
    if (!sel) return;
    const prev = sel.segmento;
    // Optimista: actualiza selección y lista al toque.
    setSel({ ...sel, segmento: seg });
    setConvs(cs => cs.map(c => c.contacto === sel.contacto && c.canal === sel.canal ? { ...c, segmento: seg } : c));
    const r = await fetch("/api/bandeja", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canal: sel.canal, contacto: sel.contacto, segmento: seg }),
    });
    if (!r.ok) {
      setSel({ ...sel, segmento: prev });
      setConvs(cs => cs.map(c => c.contacto === sel.contacto && c.canal === sel.canal ? { ...c, segmento: prev } : c));
      alert("No se pudo cambiar el segmento");
    }
  }

  const pendientes = convs.filter(c => c.espera_respuesta).length;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Inbox className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Bandeja de entrada</h1>
            <p className="text-sm text-gray-500">Todas tus conversaciones en un solo lugar. {pendientes > 0 && <span className="text-amber-600 font-medium">{pendientes} esperan respuesta.</span>}</p>
          </div>
        </div>
        <button onClick={loadConvs} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden grid md:grid-cols-3 h-[70vh]">
        {/* Lista */}
        <div className={`border-r overflow-y-auto min-h-0 ${sel ? "hidden md:block" : ""}`}>
          {loading ? (
            <p className="text-gray-400 text-sm p-4">Cargando...</p>
          ) : convs.length === 0 ? (
            <p className="text-gray-400 text-sm p-4">No hay conversaciones todavía.</p>
          ) : convs.map(c => {
            const Icon = CANAL_ICON[c.canal];
            return (
              <button key={c.canal + c.contacto} onClick={() => abrir(c)}
                className={`w-full text-left p-3 border-b hover:bg-gray-50 ${sel?.contacto === c.contacto ? "bg-indigo-50" : ""}`}>
                <div className="flex items-center gap-2">
                  <Icon size={14} className={CANAL_COLOR[c.canal]} />
                  <span className="text-sm font-medium text-gray-800 truncate flex-1">{c.contacto}</span>
                  {c.espera_respuesta && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                </div>
                <p className="text-xs text-gray-500 truncate mt-1">
                  {c.ultima_direccion === "saliente" ? "Vos: " : ""}{c.ultimo_texto}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-gray-400">{hora(c.ultima_fecha)}</p>
                  {c.segmento && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SEG_STYLE[c.segmento]}`}>{SEG_LABEL[c.segmento]}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Hilo */}
        <div className={`md:col-span-2 flex flex-col min-h-0 ${!sel ? "hidden md:flex" : ""}`}>
          {!sel ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Elegí una conversación</div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-2 shrink-0 bg-white">
                <button onClick={() => setSel(null)}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
                  <ArrowLeft size={18} /> <span className="hidden sm:inline">Volver</span>
                </button>
                {(() => { const Icon = CANAL_ICON[sel.canal]; return <Icon size={16} className={CANAL_COLOR[sel.canal]} />; })()}
                <span className="text-sm font-medium text-gray-800 truncate">{sel.contacto}</span>
                {sel.canal === "whatsapp" && (
                  <select
                    value={sel.segmento ?? ""}
                    onChange={e => e.target.value && cambiarSegmento(e.target.value as Segmento)}
                    className="ml-auto shrink-0 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600"
                    title="Segmento del cliente"
                  >
                    <option value="" disabled>Segmento…</option>
                    <option value="minorista">🛍️ Minorista</option>
                    <option value="mayorista">📦 Mayorista</option>
                    <option value="empresarial">🏢 Empresa</option>
                  </select>
                )}
                <button onClick={() => { setAgendarOpen(o => !o); setAgendaMsg(""); }}
                  title="Agendar en Captación"
                  className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border ${agendarOpen ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"} ${sel.canal === "whatsapp" ? "" : "ml-auto"}`}>
                  <UserPlus size={13} /> Agendar
                </button>
              </div>

              {/* Formulario para agendar el contacto como prospecto */}
              {agendarOpen && (
                <div className="p-3 border-b bg-emerald-50/40 shrink-0 space-y-2">
                  <p className="text-xs text-gray-500">Guardá este contacto en <b>Captación</b> (teléfono: {sel.contacto}).</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={agenda.nombre} onChange={e => setAgenda({ ...agenda, nombre: e.target.value })}
                      placeholder="Nombre / comercio *" className="text-sm border rounded-lg px-2 py-1.5 outline-none" />
                    <input value={agenda.rubro} onChange={e => setAgenda({ ...agenda, rubro: e.target.value })}
                      placeholder="Rubro (ej: kiosco)" className="text-sm border rounded-lg px-2 py-1.5 outline-none" />
                    <input value={agenda.email} onChange={e => setAgenda({ ...agenda, email: e.target.value })}
                      placeholder="Email" className="text-sm border rounded-lg px-2 py-1.5 outline-none" />
                    <input value={agenda.provincia} onChange={e => setAgenda({ ...agenda, provincia: e.target.value })}
                      placeholder="Provincia / ciudad" className="text-sm border rounded-lg px-2 py-1.5 outline-none" />
                  </div>
                  <input value={agenda.notas} onChange={e => setAgenda({ ...agenda, notas: e.target.value })}
                    placeholder="Notas (opcional)" className="w-full text-sm border rounded-lg px-2 py-1.5 outline-none" />
                  <div className="flex items-center gap-2">
                    <button onClick={agendarProspecto} disabled={agendando}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-xl">
                      {agendando ? "Guardando..." : "Agendar en Captación"}
                    </button>
                    {agendaMsg && <span className="text-xs text-gray-600">{agendaMsg}</span>}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {cargandoHilo ? (
                  <p className="text-gray-400 text-sm">Cargando...</p>
                ) : hilo.map((m, i) => (
                  <div key={i} className={`flex ${m.direccion === "entrante" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.direccion === "entrante" ? "bg-white border text-gray-800"
                      : m.direccion === "error" ? "bg-red-50 text-red-600 border border-red-100"
                      : "bg-indigo-600 text-white"}`}>
                      <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                      <p className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${m.direccion === "saliente" ? "text-indigo-200" : "text-gray-400"}`}>
                        {hora(m.fecha)}
                        {m.direccion === "saliente" && <TildeEstado estado={m.estado} />}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={finRef} />
              </div>

              <div className="px-3 pt-2 shrink-0 bg-white flex items-center border-t">
                <label className="text-[11px] text-gray-500 flex items-center gap-1.5 cursor-pointer" title="Manda la foto como archivo, sin que WhatsApp le baje la calidad">
                  <input type="checkbox" checked={altaCalidad} onChange={e => setAltaCalidad(e.target.checked)} className="accent-indigo-600" />
                  Enviar fotos en alta calidad (como archivo)
                </label>
              </div>
              <div className="px-3 pb-3 pt-1 flex items-end gap-2 shrink-0 bg-white">
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => e.target.files?.[0] && enviarAdjunto(e.target.files[0])} />
                <button onClick={() => fileRef.current?.click()} disabled={subiendo || enviando}
                  title="Enviar foto o PDF"
                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-50 p-2.5 rounded-xl shrink-0">
                  {subiendo ? <RefreshCw size={16} className="animate-spin" /> : <Paperclip size={16} />}
                </button>
                <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={1}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder={subiendo ? "Enviando archivo..." : "Escribí una respuesta (o el pie de la foto)..."}
                  className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none resize-none max-h-24" />
                <button onClick={enviar} disabled={enviando || !respuesta.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-xl shrink-0">
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
