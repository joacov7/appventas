"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, Send, RefreshCw } from "lucide-react";

interface Accion { tool: string; input: any; resumen: string }
interface Msg { de: "vos" | "jefe"; texto: string; accion?: Accion }

const SUGERENCIAS = ["¿Cómo venimos este mes?", "Conversaciones pendientes", "¿A quién sigo?", "Reporte del día", "¿Dónde estoy caro?"];

export default function JefePage() {
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "jefe", texto: "Hola 👋 Soy tu Jefe de Gabinete. Preguntame cómo viene el negocio o pedime que haga algo (contactar a alguien, correr un agente…). Escribí «ayuda» para ver ejemplos." }]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, cargando]);

  async function enviar(mensaje?: string) {
    const q = (mensaje ?? texto).trim();
    if (!q || cargando) return;
    setMsgs(prev => [...prev, { de: "vos", texto: q }]);
    setTexto(""); setCargando(true);
    try {
      const r = await fetch("/api/jefe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensaje: q }) });
      const d = await r.json();
      setMsgs(prev => [...prev, { de: "jefe", texto: d.texto ?? "…", accion: d.tipo === "confirmar" ? d.accion : undefined }]);
    } catch { setMsgs(prev => [...prev, { de: "jefe", texto: "No pude procesar eso." }]); }
    setCargando(false);
  }

  async function confirmar(accion: Accion, i: number) {
    setCargando(true);
    // Saca los botones del mensaje confirmado.
    setMsgs(prev => prev.map((m, idx) => idx === i ? { ...m, accion: undefined } : m));
    setMsgs(prev => [...prev, { de: "vos", texto: "Sí, dale" }]);
    try {
      const r = await fetch("/api/jefe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmar: true, accion }) });
      const d = await r.json();
      setMsgs(prev => [...prev, { de: "jefe", texto: d.texto ?? "Hecho." }]);
    } catch { setMsgs(prev => [...prev, { de: "jefe", texto: "No pude ejecutar la acción." }]); }
    setCargando(false);
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
      <div className="flex items-center gap-3 mb-3">
        <Briefcase className="text-gray-800" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Jefe de Gabinete</h1>
          <p className="text-sm text-gray-500">Hablá con el jefe: consultá el negocio o pedile que coordine a los agentes.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.de === "vos" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.de === "vos" ? "bg-gray-800 text-white" : "bg-white border text-gray-800"}`}>
              <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: m.texto.replace(/<b>/g, "<b class='font-semibold'>") }} />
              {m.accion && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => confirmar(m.accion!, i)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg">Sí, dale</button>
                  <button onClick={() => setMsgs(prev => prev.map((x, idx) => idx === i ? { ...x, accion: undefined } : x))} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg">No</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {cargando && <div className="flex justify-start"><div className="bg-white border rounded-2xl px-3 py-2 text-sm text-gray-400 flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> pensando…</div></div>}
        <div ref={finRef} />
      </div>

      <div className="flex gap-1.5 flex-wrap mt-2">
        {SUGERENCIAS.map(s => (
          <button key={s} onClick={() => enviar(s)} disabled={cargando}
            className="text-xs border border-gray-200 rounded-full px-3 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-50">{s}</button>
        ))}
      </div>

      <div className="flex items-end gap-2 mt-2">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={1}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribile al jefe…"
          className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none resize-none max-h-28" />
        <button onClick={() => enviar()} disabled={cargando || !texto.trim()}
          className="bg-gray-800 hover:bg-black disabled:opacity-50 text-white p-2.5 rounded-xl"><Send size={16} /></button>
      </div>
    </div>
  );
}
