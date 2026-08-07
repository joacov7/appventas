"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, Copy, Check, Target, Film } from "lucide-react";
import { ProductoPickerML } from "@/components/admin/ProductoPickerML";

interface Idea {
  producto: string; objetivo: string; publico: string; emocion: string; formato: string;
  gancho: string; idea: string; guion: string[]; texto_pantalla: string[]; caption: string; hashtags: string[];
}

export default function IdeaViralPage() {
  const [foco, setFoco] = useState<{ id: string; name: string } | null>(null);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState("");

  async function pedir() {
    setCargando(true); setError("");
    const r = await fetch("/api/marketing/idea-viral", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focoId: foco?.id, evitar: idea?.gancho }),
    });
    setCargando(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok) setIdea(d);
    else setError(d.error ?? "No se pudo generar la idea");
  }

  function copiar(texto: string, clave: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(clave); setTimeout(() => setCopiado(""), 1500);
  }

  const captionCompleta = idea ? [idea.caption, idea.hashtags.map(h => `#${h}`).join(" ")].filter(Boolean).join("\n\n") : "";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Target className="text-rose-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Idea viral</h1>
          <p className="text-sm text-gray-500">La IA analiza tu catálogo (márgenes, stock, diferencias) y te propone una idea concreta para vender.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div>
          <label className="text-xs text-gray-500">Enfocar en un producto (opcional — si no, elige la IA)</label>
          <div className="mt-1"><ProductoPickerML onSelect={p => setFoco({ id: (p as any).id, name: p.name })} placeholder="Dejar vacío para que decida la IA…" /></div>
          {foco && <p className="text-xs text-gray-400 mt-1">Enfocado en: <b>{foco.name}</b> · <button onClick={() => setFoco(null)} className="text-rose-600 hover:underline">quitar</button></p>}
        </div>
        <button onClick={pedir} disabled={cargando}
          className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-base">
          {cargando ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {cargando ? "Pensando…" : idea ? "Dame otra idea" : "🎯 Dame una idea viral"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {idea && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          {/* Estrategia */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([["Objetivo", idea.objetivo], ["Público", idea.publico], ["Emoción", idea.emocion], ["Formato", idea.formato]] as const).map(([k, v]) => v ? (
              <div key={k} className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{k}</p>
                <p className="text-sm font-medium text-gray-800">{v}</p>
              </div>
            ) : null)}
          </div>

          {idea.producto && <p className="text-sm text-gray-500">Producto: <b className="text-gray-800">{idea.producto}</b></p>}

          {/* Gancho */}
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-rose-400 mb-1">Gancho</p>
            <p className="text-lg font-bold text-gray-900 leading-snug">“{idea.gancho}”</p>
          </div>

          {idea.idea && <p className="text-sm text-gray-600">{idea.idea}</p>}

          {idea.guion.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><Film size={13} /> Guion / qué grabar</p>
              <ol className="text-sm text-gray-700 list-decimal ml-5 space-y-1">
                {idea.guion.map((g, i) => <li key={i}>{g}</li>)}
              </ol>
            </div>
          )}

          {idea.texto_pantalla.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Textos en pantalla</p>
              <div className="flex flex-wrap gap-1.5">
                {idea.texto_pantalla.map((t, i) => <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">{t}</span>)}
              </div>
            </div>
          )}

          {(idea.caption || idea.hashtags.length > 0) && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase">Texto del posteo</p>
                <button onClick={() => copiar(captionCompleta, "cap")} className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800">
                  {copiado === "cap" ? <Check size={14} /> : <Copy size={14} />} Copiar
                </button>
              </div>
              {idea.caption && <p className="text-sm text-gray-700 whitespace-pre-wrap">{idea.caption}</p>}
              {idea.hashtags.length > 0 && <p className="text-sm text-rose-600 mt-1">{idea.hashtags.map(h => `#${h}`).join(" ")}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
