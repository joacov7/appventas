"use client";

import { useEffect, useState } from "react";
import { Handshake, Save } from "lucide-react";

interface Politica {
  activa: boolean; permite_descuento: boolean; escalar_monto: number;
  medios_pago: string; envio: string; minimo_mayorista: string;
  descuento_volumen: string; cierre: "preparar_y_avisar" | "solo_avisar"; extra: string;
}

export default function VentasAgentePage() {
  const [p, setP] = useState<Politica | null>(null);
  const [msg, setMsg] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/ventas/politica").then(r => r.json()).then(setP).catch(() => {});
  }, []);

  function set<K extends keyof Politica>(k: K, v: Politica[K]) { setP(prev => prev ? { ...prev, [k]: v } : prev); }

  async function guardar() {
    if (!p) return;
    setGuardando(true); setMsg("");
    const r = await fetch("/api/ventas/politica", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
    });
    setGuardando(false);
    setMsg(r.ok ? "✅ Guardado" : "Error al guardar");
  }

  if (!p) return <p className="text-sm text-gray-400 p-6">Cargando…</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Handshake className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gerente de Ventas — Política</h1>
          <p className="text-sm text-gray-500">Las reglas con las que el asistente vende. Todo editable.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input type="checkbox" checked={p.activa} onChange={e => set("activa", e.target.checked)} className="accent-emerald-600" />
          <b>Aplicar política de ventas</b> (el asistente sigue estas reglas)
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={p.permite_descuento} onChange={e => set("permite_descuento", e.target.checked)} className="accent-emerald-600" />
          Puede ofrecer descuentos por su cuenta
        </label>

        <div>
          <label className="text-xs text-gray-500">Escalar al equipo si el pedido supera (ARS)</label>
          <input type="number" min={0} value={p.escalar_monto || ""} onChange={e => set("escalar_monto", Math.max(0, Number(e.target.value) || 0))}
            className="w-48 mt-1 text-sm border rounded-xl px-3 py-2 outline-none block" />
        </div>

        <div>
          <label className="text-xs text-gray-500">Al cerrar, el asistente…</label>
          <div className="grid sm:grid-cols-2 gap-2 mt-1">
            {([["preparar_y_avisar", "Toma el pedido y avisa (arma la orden)"], ["solo_avisar", "Solo toma los datos y avisa"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => set("cierre", v)}
                className={`text-sm py-2 px-3 rounded-lg border text-left ${p.cierre === v ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600"}`}>{l}</button>
            ))}
          </div>
        </div>

        {([
          ["minimo_mayorista", "Pedido mínimo mayorista"],
          ["medios_pago", "Medios de pago"],
          ["envio", "Envío"],
          ["descuento_volumen", "Descuento por volumen (cómo lo maneja)"],
          ["extra", "Instrucciones extra (opcional)"],
        ] as [keyof Politica, string][]).map(([k, label]) => (
          <div key={k}>
            <label className="text-xs text-gray-500">{label}</label>
            <textarea value={String(p[k] ?? "")} onChange={e => set(k, e.target.value as any)} rows={2}
              className="w-full mt-1 text-sm border rounded-xl px-3 py-2 outline-none resize-y" />
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <button onClick={guardar} disabled={guardando}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Save size={16} /> {guardando ? "Guardando…" : "Guardar política"}
          </button>
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
        </div>
        <p className="text-[11px] text-gray-400">Estas reglas alimentan al asistente cuando vende por WhatsApp (modo IA conversacional). Es la base del futuro Gerente de Ventas.</p>
      </div>
    </div>
  );
}
