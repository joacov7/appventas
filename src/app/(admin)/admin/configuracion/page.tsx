"use client";

import { useEffect, useState } from "react";
import { Settings, Check, TrendingUp } from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";

const DEFAULT_MARGENES = { minorista: 45, mayorista: 25, distribuidor: 15 };
const DEFAULT_MEDIOS_PAGO = {
  efectivo: 0, transferencia: 0, debito: 1.5,
  credito1: 3.5, credito3: 8, credito6: 15, mercadoPago: 5.99, echeq: 2,
};
const MEDIO_LABELS: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito",
  credito1: "Crédito 1 cuota", credito3: "Crédito 3 cuotas", credito6: "Crédito 6 cuotas",
  mercadoPago: "MercadoPago", echeq: "E-cheq",
};

export default function ConfiguracionPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoAltura, setLogoAltura] = useState(40);
  const [storeName, setStoreName] = useState("");
  const [textoAlCostado, setTextoAlCostado] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [margenes, setMargenes] = useState(DEFAULT_MARGENES);
  const [mediosPago, setMediosPago] = useState<Record<string, number>>(DEFAULT_MEDIOS_PAGO);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savedPricing, setSavedPricing] = useState(false);

  useEffect(() => {
    fetch("/api/store-config")
      .then(r => r.json())
      .then(data => {
        setLogoUrl(data.logoUrl ?? null);
        setLogoAltura(data.logoAltura ?? 40);
        setStoreName(data.storeName ?? "");
        setTextoAlCostado(data.textoAlCostado ?? "");
      })
      .finally(() => setLoading(false));

    fetch("/api/precio-config")
      .then(r => r.json())
      .then(data => {
        setMargenes({ ...DEFAULT_MARGENES, ...data.margenes });
        setMediosPago({ ...DEFAULT_MEDIOS_PAGO, ...data.mediosPago });
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/store-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl, logoAltura, storeName, textoAlCostado }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function savePricing() {
    setSavingPricing(true);
    await fetch("/api/precio-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ margenes, mediosPago }),
    });
    setSavingPricing(false);
    setSavedPricing(true);
    setTimeout(() => setSavedPricing(false), 2000);
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>;

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings size={20} className="text-emerald-600" />
        <h1 className="text-2xl font-bold text-gray-900">Configuración general</h1>
      </div>

      {/* Precios */}
      <div className="bg-white rounded-2xl border p-6 space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-600" />
          <h2 className="font-semibold text-gray-900">Márgenes de precio</h2>
        </div>

        <div className="space-y-4">
          {(["minorista", "mayorista", "distribuidor"] as const).map(seg => (
            <div key={seg}>
              <label className="flex justify-between text-sm font-medium text-gray-700 mb-1 capitalize">
                <span>{seg}</span>
                <span className="text-emerald-600 font-bold">{margenes[seg]}%</span>
              </label>
              <input
                type="range" min={1} max={80} value={margenes[seg]}
                onChange={e => setMargenes(m => ({ ...m, [seg]: Number(e.target.value) }))}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1%</span><span>80%</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Ej: costo $1000 → precio {seg} ${Math.round(1000 / (1 - margenes[seg] / 100)).toLocaleString("es-AR")}
              </p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Recargos por medio de pago</h3>
          <div className="space-y-2">
            {Object.keys(DEFAULT_MEDIOS_PAGO).map(key => (
              <div key={key} className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-36">{MEDIO_LABELS[key]}</label>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={mediosPago[key] ?? 0}
                    onChange={e => setMediosPago(m => ({ ...m, [key]: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-3 pr-8 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={savePricing}
          disabled={savingPricing}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium"
        >
          {savedPricing ? <><Check size={15} /> Guardado</> : savingPricing ? "Guardando..." : "Guardar márgenes"}
        </button>
      </div>

      <div className="bg-white rounded-2xl border p-6 space-y-6">
        {/* Vista previa */}
        {logoUrl && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Vista previa del navbar</p>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border">
              <img src={logoUrl} alt="Logo" style={{ height: logoAltura, width: "auto", objectFit: "contain" }} />
              {textoAlCostado && (
                <span className="font-bold text-gray-900 text-lg">{textoAlCostado}</span>
              )}
            </div>
          </div>
        )}

        {/* Logo */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Logo de la tienda</label>
          <MediaUpload
            urls={logoUrl ? [logoUrl] : []}
            onChange={urls => setLogoUrl(urls[0] ?? null)}
          />
          <p className="text-xs text-gray-400 mt-1">PNG o SVG con fondo transparente.</p>
        </div>

        {/* Altura del logo */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Tamaño del logo: {logoAltura}px
          </label>
          <input
            type="range" min={24} max={80} value={logoAltura}
            onChange={e => setLogoAltura(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>Chico</span><span>Grande</span>
          </div>
        </div>

        {/* Texto al costado */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Texto al costado del logo</label>
          <input
            value={textoAlCostado}
            onChange={e => setTextoAlCostado(e.target.value)}
            placeholder="Pava Negra"
            className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-400 mt-1">Opcional. Aparece junto al logo en el navbar.</p>
        </div>

        {/* Nombre fallback */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la tienda (sin logo)</label>
          <input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder="Pava Negra"
            className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-400 mt-1">Se muestra si no hay logo cargado.</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium"
        >
          {saved ? <><Check size={15} /> Guardado</> : saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
