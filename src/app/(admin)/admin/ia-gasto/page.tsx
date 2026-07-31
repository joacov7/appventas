"use client";

import { useEffect, useState } from "react";
import { DollarSign, RefreshCw } from "lucide-react";

interface Fila { feature?: string; model?: string; total: number; llamadas: number }
interface Resumen {
  mes: number; limite: number; cortar: boolean;
  porFuncion: Fila[]; porModelo: Fila[];
}

const usd = (n: number) => `US$ ${n.toFixed(n < 1 ? 4 : 2)}`;
const LABEL: Record<string, string> = {
  "idea-viral": "Idea viral", "reel-copy": "Copy de reels", "titulos-ml": "Títulos ML",
  "bot-ia": "Bot IA conversacional", "otros": "Otros",
};

export default function IAGastoPage() {
  const [r, setR] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [limite, setLimite] = useState(0);
  const [cortar, setCortar] = useState(false);
  const [msg, setMsg] = useState("");

  async function cargar() {
    setCargando(true);
    const d = await fetch("/api/ia/gasto").then(x => x.json()).catch(() => null);
    if (d) { setR(d); setLimite(d.limite ?? 0); setCortar(!!d.cortar); }
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setMsg("");
    const res = await fetch("/api/ia/gasto", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limite_usd: limite, cortar }),
    });
    setMsg(res.ok ? "✅ Guardado" : "Error");
    cargar();
  }

  const pct = r && r.limite > 0 ? Math.min(100, Math.round((r.mes / r.limite) * 100)) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <DollarSign className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gasto de IA</h1>
          <p className="text-sm text-gray-500">Cuánto se gastó este mes en las funciones con IA, y tope mensual.</p>
        </div>
        <button onClick={cargar} className="ml-auto text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {cargando ? <p className="text-sm text-gray-400">Cargando…</p> : r && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Gasto del mes</p>
            <p className="text-3xl font-bold text-gray-900">{usd(r.mes)}</p>
            {r.limite > 0 && (
              <>
                <div className="w-full h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
                  <div className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{pct}% del tope ({usd(r.limite)}){r.cortar ? " · corta al superar" : ""}</p>
              </>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-sm font-medium text-gray-800 mb-2">Por función</p>
              {r.porFuncion.length === 0 ? <p className="text-xs text-gray-400">Sin gasto este mes.</p> : (
                <div className="space-y-1.5">
                  {r.porFuncion.map(f => (
                    <div key={f.feature} className="flex justify-between text-sm">
                      <span className="text-gray-600">{LABEL[f.feature ?? "otros"] ?? f.feature} <span className="text-gray-300">×{f.llamadas}</span></span>
                      <span className="text-gray-800 font-medium">{usd(f.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-sm font-medium text-gray-800 mb-2">Por modelo</p>
              {r.porModelo.length === 0 ? <p className="text-xs text-gray-400">Sin gasto este mes.</p> : (
                <div className="space-y-1.5">
                  {r.porModelo.map(m => (
                    <div key={m.model} className="flex justify-between text-sm">
                      <span className="text-gray-600 truncate">{m.model} <span className="text-gray-300">×{m.llamadas}</span></span>
                      <span className="text-gray-800 font-medium">{usd(m.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <p className="text-sm font-medium text-gray-800">Tope mensual</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">US$</span>
              <input type="number" min={0} step={1} value={limite || ""} placeholder="0 = sin límite"
                onChange={e => setLimite(Math.max(0, Number(e.target.value) || 0))}
                className="w-40 text-sm border rounded-lg px-3 py-2 outline-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={cortar} onChange={e => setCortar(e.target.checked)} className="accent-emerald-600" />
              Cortar las funciones de IA al superar el tope
            </label>
            <p className="text-[11px] text-gray-400">Si está tildado y llegás al tope, las funciones de IA dejan de generar hasta el mes siguiente (o hasta que subas el límite). El bot cae al menú de siempre.</p>
            <div className="flex items-center gap-3">
              <button onClick={guardar} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-xl">Guardar</button>
              {msg && <span className="text-xs text-gray-500">{msg}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
