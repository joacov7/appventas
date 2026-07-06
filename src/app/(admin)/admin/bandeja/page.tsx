"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Inbox, RefreshCw, Send, MessageCircle, Instagram, Facebook, ArrowLeft } from "lucide-react";

type Canal = "whatsapp" | "instagram" | "facebook";
interface Conversacion {
  canal: Canal; contacto: string; ultimo_texto: string; ultima_fecha: string;
  ultima_direccion: "entrante" | "saliente" | "error"; total: number; espera_respuesta: boolean;
}
interface Mensaje { direccion: "entrante" | "saliente" | "error"; texto: string; fecha: string }

const CANAL_ICON: Record<Canal, any> = { whatsapp: MessageCircle, instagram: Instagram, facebook: Facebook };
const CANAL_COLOR: Record<Canal, string> = { whatsapp: "text-emerald-600", instagram: "text-pink-600", facebook: "text-blue-600" };

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
  const finRef = useRef<HTMLDivElement>(null);

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
        <div className={`border-r overflow-y-auto ${sel ? "hidden md:block" : ""}`}>
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
                <p className="text-[10px] text-gray-400 mt-0.5">{hora(c.ultima_fecha)}</p>
              </button>
            );
          })}
        </div>

        {/* Hilo */}
        <div className={`md:col-span-2 flex flex-col ${!sel ? "hidden md:flex" : ""}`}>
          {!sel ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Elegí una conversación</div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-2">
                <button onClick={() => setSel(null)}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm">
                  <ArrowLeft size={18} /> <span className="hidden sm:inline">Volver</span>
                </button>
                {(() => { const Icon = CANAL_ICON[sel.canal]; return <Icon size={16} className={CANAL_COLOR[sel.canal]} />; })()}
                <span className="text-sm font-medium text-gray-800 truncate">{sel.contacto}</span>
                <span className="text-xs text-gray-400 ml-auto capitalize shrink-0">{sel.canal}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {cargandoHilo ? (
                  <p className="text-gray-400 text-sm">Cargando...</p>
                ) : hilo.map((m, i) => (
                  <div key={i} className={`flex ${m.direccion === "entrante" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.direccion === "entrante" ? "bg-white border text-gray-800"
                      : m.direccion === "error" ? "bg-red-50 text-red-600 border border-red-100"
                      : "bg-indigo-600 text-white"}`}>
                      <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                      <p className={`text-[10px] mt-1 ${m.direccion === "saliente" ? "text-indigo-200" : "text-gray-400"}`}>{hora(m.fecha)}</p>
                    </div>
                  </div>
                ))}
                <div ref={finRef} />
              </div>

              <div className="p-3 border-t flex items-end gap-2">
                <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={1}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder="Escribí una respuesta..."
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
