"use client";

import { useState } from "react";
import { Tags, Calculator } from "lucide-react";

// Herramientas de catálogo: recalcular minoristas (mayorista + %) y clasificar por rubro.
export function HerramientasCatalogo() {
  const [markup, setMarkup] = useState(50);
  const [redondeo, setRedondeo] = useState(100);
  const [recalc, setRecalc] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);
  const [clasif, setClasif] = useState(false);
  const [clasifMsg, setClasifMsg] = useState<string | null>(null);
  const [clasifErr, setClasifErr] = useState<string | null>(null);

  async function recalcular() {
    setRecalc(true); setRecalcMsg(null);
    const r = await fetch("/api/productos/recalcular-minorista", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markup, redondeo }),
    });
    setRecalc(false);
    const d = await r.json().catch(() => ({}));
    setRecalcMsg(r.ok ? `✅ ${d.actualizados} producto(s): minorista = mayorista +${markup}%, redondeado a $${redondeo}.` : `Error: ${d.error ?? r.status}`);
  }

  const [aplicMay, setAplicMay] = useState(false);
  const [aplicMayMsg, setAplicMayMsg] = useState<string | null>(null);
  async function aplicarMayorista() {
    if (!confirm("Poner el precio MAYORISTA como precio visible de la tienda (para el modo mayorista)?")) return;
    setAplicMay(true); setAplicMayMsg(null);
    const r = await fetch("/api/productos/aplicar-mayorista", { method: "POST" });
    setAplicMay(false);
    const d = await r.json().catch(() => ({}));
    setAplicMayMsg(r.ok ? `✅ ${d.actualizados} producto(s) con precio mayorista en la tienda.` : `Error: ${d.error ?? r.status}`);
  }

  async function clasificar() {
    setClasif(true); setClasifMsg(null); setClasifErr(null);
    const r = await fetch("/api/productos/clasificar", { method: "POST" });
    setClasif(false);
    const d = await r.json().catch(() => ({}));
    if (d.errores?.length) setClasifErr(d.errores.join(" · "));
    else if (!r.ok) setClasifErr(d.error ?? `HTTP ${r.status}`);
    else {
      const res = d.resultado ?? {};
      const txt = Object.entries(res).filter(([, n]: any) => n > 0).map(([k, n]) => `${k}: ${n}`).join(" · ");
      setClasifMsg(txt || "Sin cambios (ya estaban clasificados o ninguno matcheó).");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 grid md:grid-cols-2 gap-4">
      {/* Precios minoristas */}
      <div>
        <div className="flex items-center gap-2 mb-2"><Calculator size={16} className="text-indigo-600" /><span className="text-sm font-medium text-gray-800">Precio minorista</span></div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Mayorista +</span>
          <input type="number" value={markup} onChange={e => setMarkup(Number(e.target.value))} className="w-16 text-sm border rounded-lg px-2 py-1.5 text-center" />
          <span className="text-sm text-gray-500">% · redondear a</span>
          <select value={redondeo} onChange={e => setRedondeo(Number(e.target.value))} className="text-sm border rounded-lg px-2 py-1.5 bg-white">
            <option value={10}>$10</option>
            <option value={50}>$50</option>
            <option value={100}>$100</option>
            <option value={500}>$500</option>
            <option value={1000}>$1000</option>
          </select>
          <button onClick={recalcular} disabled={recalc} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-xl">
            {recalc ? "Calculando..." : "Recalcular"}
          </button>
        </div>
        {recalcMsg && <p className="text-xs text-gray-600 mt-2 break-words">{recalcMsg}</p>}
        <div className="mt-3 pt-3 border-t">
          <button onClick={aplicarMayorista} disabled={aplicMay}
            className="text-sm border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-medium px-4 py-1.5 rounded-xl"
            title="Modo mayorista: muestra el precio mayorista en toda la tienda">
            {aplicMay ? "Aplicando..." : "Poner precios mayoristas en la tienda"}
          </button>
          {aplicMayMsg && <p className="text-xs text-gray-600 mt-2 break-words">{aplicMayMsg}</p>}
        </div>
      </div>

      {/* Clasificar por rubro */}
      <div className="md:border-l md:pl-4">
        <div className="flex items-center gap-2 mb-2"><Tags size={16} className="text-indigo-600" /><span className="text-sm font-medium text-gray-800">Rubros</span></div>
        <p className="text-xs text-gray-500 mb-2">Agrupá por mates, bombillas, materas, termos, cuchillos, tablas… para poder filtrar.</p>
        <button onClick={clasificar} disabled={clasif} className="border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium px-4 py-1.5 rounded-xl">
          {clasif ? "Clasificando..." : "Clasificar por rubro"}
        </button>
        {clasifMsg && <p className="text-xs text-gray-600 mt-2 break-words">{clasifMsg}</p>}
        {clasifErr && <p className="text-xs text-red-500 mt-2 break-words">Error: {clasifErr}</p>}
      </div>
    </div>
  );
}
