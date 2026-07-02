"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, TrendingUp, Zap, Clock, ChevronDown, ChevronUp, Check } from "lucide-react";

interface PricingConfig {
  margenes: { minorista: number; mayorista: number; distribuidor: number };
  mediosPago: Record<string, number>;
}

interface ProductPricing {
  costo: number | null;
  precio_minorista: number | null;
  precio_mayorista: number | null;
  precio_distribuidor: number | null;
  minorista_manual: boolean;
  mayorista_manual: boolean;
  distribuidor_manual: boolean;
  precios_medios_pago: Record<string, number>;
}

interface HistoryEntry {
  id: number;
  campo: string;
  valor_anterior: number | null;
  valor_nuevo: number | null;
  created_at: string;
}

const MEDIO_PAGO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito1: "Crédito 1c",
  credito3: "Crédito 3c",
  credito6: "Crédito 6c",
  mercadoPago: "MercadoPago",
  echeq: "E-cheq",
};

const CAMPO_LABELS: Record<string, string> = {
  costo: "Costo",
  precio_minorista: "P. Minorista",
  precio_mayorista: "P. Mayorista",
  precio_distribuidor: "P. Distribuidor",
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function calcSuggested(costo: number, margen: number) {
  return costo / (1 - margen / 100);
}

function roundOptions(price: number) {
  return [
    Math.ceil(price / 10) * 10,
    Math.ceil(price / 50) * 50,
    Math.ceil(price / 100) * 100,
    Math.ceil(price / 500) * 500,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= price);
}

export function PricingPanel({ productId }: { productId: string }) {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [pricing, setPricing] = useState<ProductPricing>({
    costo: null,
    precio_minorista: null,
    precio_mayorista: null,
    precio_distribuidor: null,
    minorista_manual: false,
    mayorista_manual: false,
    distribuidor_manual: false,
    precios_medios_pago: {},
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [costo, setCosto] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [smartTarget, setSmartTarget] = useState<"minorista" | "mayorista" | "distribuidor" | null>(null);
  const [overrides, setOverrides] = useState<{ minorista: string; mayorista: string; distribuidor: string }>({
    minorista: "", mayorista: "", distribuidor: "",
  });
  const [manualFlags, setManualFlags] = useState({ minorista: false, mayorista: false, distribuidor: false });

  useEffect(() => {
    fetch("/api/precio-config").then(r => r.json()).then(setConfig).catch(() => {});
    fetch(`/api/productos/${productId}/precio`)
      .then(r => r.json())
      .then(data => {
        if (data.pricing) {
          const p = data.pricing;
          setPricing(p);
          setCosto(p.costo != null ? String(Number(p.costo)) : "");
          setOverrides({
            minorista: p.precio_minorista != null ? String(Math.round(Number(p.precio_minorista))) : "",
            mayorista: p.precio_mayorista != null ? String(Math.round(Number(p.precio_mayorista))) : "",
            distribuidor: p.precio_distribuidor != null ? String(Math.round(Number(p.precio_distribuidor))) : "",
          });
          setManualFlags({
            minorista: p.minorista_manual,
            mayorista: p.mayorista_manual,
            distribuidor: p.distribuidor_manual,
          });
        }
        setHistory(data.history ?? []);
      })
      .catch(() => {});
  }, [productId]);

  const costoNum = parseFloat(costo) || null;

  function getSuggested(seg: "minorista" | "mayorista" | "distribuidor") {
    if (!costoNum || !config) return null;
    return calcSuggested(costoNum, config.margenes[seg]);
  }

  function getEffective(seg: "minorista" | "mayorista" | "distribuidor") {
    if (manualFlags[seg] && overrides[seg]) return parseFloat(overrides[seg]) || null;
    return getSuggested(seg);
  }

  function applyRound(seg: "minorista" | "mayorista" | "distribuidor", val: number) {
    setOverrides(o => ({ ...o, [seg]: String(val) }));
    setManualFlags(f => ({ ...f, [seg]: true }));
    setSmartTarget(null);
  }

  function resetToAuto(seg: "minorista" | "mayorista" | "distribuidor") {
    setManualFlags(f => ({ ...f, [seg]: false }));
    setOverrides(o => ({ ...o, [seg]: "" }));
  }

  async function save() {
    setSaving(true);
    const minoristaPrice = manualFlags.minorista ? (parseFloat(overrides.minorista) || null) : getSuggested("minorista");
    const mayoristaPrice = manualFlags.mayorista ? (parseFloat(overrides.mayorista) || null) : getSuggested("mayorista");
    const distribuidorPrice = manualFlags.distribuidor ? (parseFloat(overrides.distribuidor) || null) : getSuggested("distribuidor");

    const mediosPago: Record<string, number> = {};
    if (config) {
      for (const [key, fee] of Object.entries(config.mediosPago)) {
        const price = getEffective("minorista");
        if (price) mediosPago[key] = price * (1 + fee / 100);
      }
    }

    await fetch(`/api/productos/${productId}/precio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        costo: costoNum,
        precio_minorista: minoristaPrice,
        precio_mayorista: mayoristaPrice,
        precio_distribuidor: distribuidorPrice,
        minorista_manual: manualFlags.minorista,
        mayorista_manual: manualFlags.mayorista,
        distribuidor_manual: manualFlags.distribuidor,
        precios_medios_pago: mediosPago,
      }),
    });

    // Refresh history
    const data = await fetch(`/api/productos/${productId}/precio`).then(r => r.json());
    setHistory(data.history ?? []);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const segments = [
    { key: "minorista" as const, label: "Minorista", color: "emerald" },
    { key: "mayorista" as const, label: "Mayorista", color: "blue" },
    { key: "distribuidor" as const, label: "Distribuidor", color: "purple" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 mt-6">
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-emerald-600" />
        <h2 className="font-semibold text-gray-900">Precio inteligente</h2>
      </div>

      {/* Costo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Costo del producto (ARS)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={costo}
            onChange={e => setCosto(e.target.value)}
            placeholder="0.00"
            className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        {costoNum && (
          <p className="text-xs text-gray-400 mt-1">
            Costo ingresado: {fmt(costoNum)}
          </p>
        )}
      </div>

      {/* Indicadores */}
      {costoNum && config && (
        <div className="grid grid-cols-3 gap-3">
          {segments.map(({ key, label, color }) => {
            const suggested = getSuggested(key);
            const effective = getEffective(key);
            const margin = config.margenes[key];
            const ganancia = effective && costoNum ? effective - costoNum : null;
            const pct = ganancia && effective ? (ganancia / effective) * 100 : null;

            return (
              <div key={key} className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="text-base font-bold text-gray-900">{fmt(effective)}</p>
                <p className="text-xs text-gray-400">Margen {margin}%</p>
                {ganancia != null && (
                  <p className="text-xs text-emerald-600">+{fmt(ganancia)} ({pct?.toFixed(1)}%)</p>
                )}
                {manualFlags[key] && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Manual</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Precios por segmento */}
      {costoNum && config && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Precios por segmento</h3>
          {segments.map(({ key, label }) => {
            const suggested = getSuggested(key);
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-600">{label}</div>
                <div className="flex-1">
                  {manualFlags[key] ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        value={overrides[key]}
                        onChange={e => setOverrides(o => ({ ...o, [key]: e.target.value }))}
                        className="w-full border border-amber-300 rounded-lg pl-7 pr-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700">
                      {fmt(suggested)} <span className="text-xs text-gray-400">(auto)</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSmartTarget(key)}
                  title="Precio inteligente"
                  className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                >
                  <Zap size={15} />
                </button>
                {manualFlags[key] ? (
                  <button
                    type="button"
                    onClick={() => resetToAuto(key)}
                    className="text-xs text-gray-400 hover:text-gray-700 whitespace-nowrap"
                  >
                    Auto
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOverrides(o => ({ ...o, [key]: suggested ? String(Math.round(suggested)) : "" }));
                      setManualFlags(f => ({ ...f, [key]: true }));
                    }}
                    className="text-xs text-gray-400 hover:text-gray-700 whitespace-nowrap"
                  >
                    Editar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Smart rounding modal */}
      {smartTarget && costoNum && config && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              Opciones de redondeo — {segments.find(s => s.key === smartTarget)?.label}
            </p>
            <button onClick={() => setSmartTarget(null)} className="ml-auto text-amber-400 hover:text-amber-700 text-xs">✕</button>
          </div>
          <p className="text-xs text-amber-600">
            Precio sugerido: {fmt(getSuggested(smartTarget))}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {roundOptions(getSuggested(smartTarget) ?? 0).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => applyRound(smartTarget, v)}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 text-sm rounded-lg font-medium transition-colors"
              >
                {fmt(v)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Medios de pago */}
      {costoNum && config && getEffective("minorista") && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Precio minorista por medio de pago</h3>
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-3 py-2 font-medium">Medio</th>
                  <th className="text-right px-3 py-2 font-medium">Recargo</th>
                  <th className="text-right px-3 py-2 font-medium">Precio final</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(config.mediosPago).map(([key, fee], i) => {
                  const base = getEffective("minorista")!;
                  const final = base * (1 + fee / 100);
                  return (
                    <tr key={key} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-3 py-2 text-gray-700">{MEDIO_PAGO_LABELS[key] ?? key}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{fee > 0 ? `+${fee}%` : "—"}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(final)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guardar */}
      <button
        type="button"
        onClick={save}
        disabled={saving || !costoNum}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
      >
        {saved ? <><Check size={15} /> Precios guardados</> : saving ? "Guardando..." : "Guardar precios"}
      </button>

      {/* Historial */}
      {history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <Clock size={14} />
            Historial de cambios
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1">
              {history.map(h => (
                <div key={h.id} className="flex gap-3 text-xs text-gray-500 py-1 border-b border-gray-50">
                  <span className="text-gray-400">{new Date(h.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-medium text-gray-700">{CAMPO_LABELS[h.campo] ?? h.campo}</span>
                  <span>{fmt(h.valor_anterior)} → {fmt(h.valor_nuevo)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
