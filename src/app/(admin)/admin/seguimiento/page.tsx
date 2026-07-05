"use client";

import { useEffect, useState } from "react";
import { Clock, RefreshCw, MessageCircle, Copy, Check, Users, FileText } from "lucide-react";

interface SegProspecto {
  tipo: "prospecto"; id: number; nombre: string; rubro: string | null;
  telefono: string | null; dias: number; mensaje_sugerido: string;
}
interface SegPresupuesto {
  tipo: "presupuesto"; id: number; cliente: string; total: number; dias: number; mensaje_sugerido: string;
}
type Seg = SegProspecto | SegPresupuesto;

function waLink(tel: string, texto: string) {
  const num = tel.replace(/[^\d]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

export default function SeguimientoPage() {
  const [items, setItems] = useState<Seg[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/seguimiento");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function marcarSeguido(id: number) {
    await fetch("/api/seguimiento", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectoId: id }),
    });
    setItems(prev => prev.filter(i => !(i.tipo === "prospecto" && i.id === id)));
  }

  async function copiar(key: string, texto: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(key); setTimeout(() => setCopiado(null), 2000); } catch { /* noop */ }
  }

  const prospectos = items.filter(i => i.tipo === "prospecto").length;
  const presupuestos = items.filter(i => i.tipo === "presupuesto").length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Seguimiento</h1>
            <p className="text-sm text-gray-500">A quién re-contactar: lo que quedó tibio y conviene empujar.</p>
          </div>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><Users size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{prospectos}</p><p className="text-xs text-gray-500">Prospectos sin respuesta</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><FileText size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{presupuestos}</p><p className="text-xs text-gray-500">Presupuestos sin cerrar</p></div>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Check className="mx-auto text-emerald-400 mb-3" size={32} />
          <p className="text-gray-500 text-sm">Todo al día. No hay nada esperando seguimiento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(s => {
            const key = `${s.tipo}-${s.id}`;
            const titulo = s.tipo === "prospecto" ? s.nombre : `Presupuesto · ${s.cliente}`;
            return (
              <div key={key} className="bg-white rounded-2xl border shadow-sm p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.tipo === "prospecto" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {s.tipo === "prospecto" ? "Prospecto" : "Presupuesto"}
                    </span>
                    <h3 className="font-semibold text-gray-900">{titulo}</h3>
                    <span className="text-xs text-gray-400">hace {s.dias} día{s.dias !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-3">{s.mensaje_sugerido}</p>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => copiar(key, s.mensaje_sugerido)}
                    className="flex items-center gap-1.5 border text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg">
                    <Copy size={13} /> {copiado === key ? "Copiado ✓" : "Copiar"}
                  </button>
                  {s.tipo === "prospecto" && s.telefono && (
                    <a href={waLink(s.telefono, s.mensaje_sugerido)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 rounded-lg">
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                  {s.tipo === "prospecto" && (
                    <button onClick={() => marcarSeguido(s.id)}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm px-3 py-1.5 rounded-lg ml-auto">
                      <Check size={13} /> Marcar seguido
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
