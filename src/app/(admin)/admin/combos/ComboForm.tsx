"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Zap, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";
import { slugify } from "@/lib/utils";
import { MediaUpload } from "@/components/ui/MediaUpload";

interface Product {
  id: string;
  name: string;
  variants: { id: string; name: string; price: number; sku: string }[];
}

interface ComboItem {
  product_id: string;
  variant_id: string;
  quantity: number;
}

interface PricingConfig {
  margenes: { minorista: number; mayorista: number; distribuidor: number };
  mediosPago: Record<string, number>;
}

const MEDIO_LABELS: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito",
  credito1: "Crédito 1c", credito3: "Crédito 3c", credito6: "Crédito 6c",
  mercadoPago: "MercadoPago", echeq: "E-cheq",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function roundOptions(price: number) {
  return [
    Math.ceil(price / 10) * 10,
    Math.ceil(price / 50) * 50,
    Math.ceil(price / 100) * 100,
    Math.ceil(price / 500) * 500,
  ].filter((v, i, arr) => arr.indexOf(v) === i);
}

interface Props {
  initialData?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    image_urls: string[];
    active: boolean;
    precio_venta: number | null;
    precio_manual: boolean;
    items: ComboItem[];
  };
}

export function ComboForm({ initialData }: Props) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [imageUrls, setImageUrls] = useState<string[]>(initialData?.image_urls ?? []);
  const [active, setActive] = useState(initialData?.active ?? true);
  const [items, setItems] = useState<ComboItem[]>(initialData?.items ?? []);
  const [precioManual, setPrecioManual] = useState(initialData?.precio_manual ?? false);
  const [precioVentaInput, setPrecioVentaInput] = useState(
    initialData?.precio_venta != null ? String(Math.round(Number(initialData.precio_venta))) : ""
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  // costos reales por product_id (de product_pricing)
  const [costos, setCostos] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [smartOpen, setSmartOpen] = useState(false);

  useEffect(() => {
    fetch("/api/productos?limit=200")
      .then(r => r.json())
      .then(data => setProducts(Array.isArray(data) ? data : (data.products ?? [])))
      .catch(() => {});
    fetch("/api/precio-config").then(r => r.json()).then(setConfig).catch(() => {});
  }, []);

  // Cada vez que cambian los items, pedir costos reales al servidor
  useEffect(() => {
    const ids = [...new Set(items.map(i => i.product_id))];
    if (!ids.length) { setCostos({}); return; }
    fetch(`/api/productos/costos?ids=${ids.join(",")}`)
      .then(r => r.json())
      .then(setCostos)
      .catch(() => {});
  }, [items]);

  function getProduct(id: string) {
    return products.find(p => p.id === id);
  }

  function getVariant(productId: string, variantId: string) {
    return getProduct(productId)?.variants.find(v => v.id === variantId) ?? null;
  }

  // Precio de venta individual (precio público de cada producto)
  function getPrecioPublico(item: ComboItem): number {
    const v = getVariant(item.product_id, item.variant_id);
    return v ? Number(v.price) : 0;
  }

  // Costo real del producto (de product_pricing, si existe)
  function getCostoUnitario(item: ComboItem): number | null {
    return costos[item.product_id] ?? null;
  }

  // Precio público total si el cliente comprara todo por separado
  const precioPublicoTotal = items.reduce(
    (sum, item) => sum + getPrecioPublico(item) * item.quantity, 0
  );

  // Costo real total del combo (suma de costos × cantidades)
  const costoRealTotal = items.every(item => getCostoUnitario(item) != null)
    ? items.reduce((sum, item) => sum + (getCostoUnitario(item) ?? 0) * item.quantity, 0)
    : null;

  // Indica si algún producto del combo no tiene costo configurado
  const sinCosto = items.some(item => getCostoUnitario(item) == null);

  function getSuggested(seg: "minorista" | "mayorista" | "distribuidor"): number | null {
    if (!costoRealTotal || !config) return null;
    return costoRealTotal / (1 - config.margenes[seg] / 100);
  }

  const precioEfectivo: number | null = precioManual
    ? (parseFloat(precioVentaInput) || null)
    : getSuggested("minorista");

  function addItem() {
    if (!products.length) return;
    const p = products[0];
    setItems(prev => [...prev, { product_id: p.id, variant_id: p.variants[0]?.id ?? "", quantity: 1 }]);
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, patch: Partial<ComboItem>) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const next = { ...item, ...patch };
      if (patch.product_id) {
        const p = products.find(p => p.id === patch.product_id);
        next.variant_id = p?.variants[0]?.id ?? "";
      }
      return next;
    }));
  }

  async function save() {
    if (!name || !slug) { setError("Nombre y slug son requeridos."); return; }
    if (!items.length) { setError("Agregá al menos un producto al combo."); return; }
    setSaving(true);
    setError("");
    const precioFinal = precioManual
      ? (parseFloat(precioVentaInput) || null)
      : (precioEfectivo != null ? Math.round(precioEfectivo) : null);
    const body = {
      name, slug, description, image_urls: imageUrls, active,
      precio_venta: precioFinal,
      precio_manual: precioManual,
      items,
    };
    try {
      if (isEdit) {
        const res = await fetch(`/api/combos/${initialData!.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch("/api/combos", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      router.push("/admin/combos");
    } catch (e: any) {
      setError(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/combos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft size={16} /> Volver a combos
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? "Editar combo" : "Nuevo combo"}</h1>

      <div className="space-y-5">
        {/* Info general */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Información general</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); if (!isEdit) setSlug(slugify(e.target.value)); }}
              placeholder="Kit Mate Premium"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
            <input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Imágenes</label>
            <MediaUpload urls={imageUrls} onChange={setImageUrls} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Combo activo</span>
          </label>
        </div>

        {/* Productos del combo */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Productos del combo</h2>
            <button
              type="button"
              onClick={addItem}
              disabled={!products.length}
              className="inline-flex items-center gap-1 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>

          {items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Agregá productos para armar el combo.</p>
          )}

          {items.map((item, i) => {
            const p = getProduct(item.product_id);
            const v = p?.variants.find(v => v.id === item.variant_id);
            const precioPublico = getPrecioPublico(item);
            const costoUnit = getCostoUnitario(item);
            return (
              <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Producto</label>
                      <select
                        value={item.product_id}
                        onChange={e => updateItem(i, { product_id: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {p && p.variants.length > 1 && (
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Variante</label>
                        <select
                          value={item.variant_id}
                          onChange={e => updateItem(i, { variant_id: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          {p.variants.map(v => (
                            <option key={v.id} value={v.id}>{v.name} — {fmt(Number(v.price))}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateItem(i, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                      <div className="space-y-0.5 mt-3">
                        <p className="text-xs text-gray-400">
                          Precio público: <span className="font-medium text-gray-700">{fmt(precioPublico * item.quantity)}</span>
                        </p>
                        <p className="text-xs text-gray-400">
                          Costo: {costoUnit != null
                            ? <span className="font-medium text-emerald-700">{fmt(costoUnit * item.quantity)}</span>
                            : <span className="text-amber-500">sin configurar</span>
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="mt-1 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {items.length > 0 && (
            <div className="space-y-1 px-1 pt-1 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Precio público (suma individual)</span>
                <span className="text-sm font-medium text-gray-700">{fmt(precioPublicoTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Costo real del combo</span>
                {costoRealTotal != null
                  ? <span className="text-base font-bold text-gray-900">{fmt(costoRealTotal)}</span>
                  : <span className="text-sm text-amber-500 flex items-center gap-1"><AlertCircle size={13} /> Configurar costos</span>
                }
              </div>
            </div>
          )}
        </div>

        {/* Aviso si faltan costos */}
        {sinCosto && items.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-amber-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>
              Algunos productos no tienen costo configurado. Ingresá el costo en{" "}
              <strong>Productos → Editar → Precio inteligente</strong> para obtener sugerencias precisas.
              Igual podés establecer el precio del combo manualmente.
            </p>
          </div>
        )}

        {/* Panel de precios — solo si hay costo real o precio manual */}
        {items.length > 0 && config && (costoRealTotal != null || precioManual) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" />
              <h2 className="font-semibold text-gray-900">Precio inteligente</h2>
            </div>

            {/* Sugeridos por segmento */}
            {costoRealTotal != null && (
              <div className="grid grid-cols-3 gap-3">
                {(["minorista", "mayorista", "distribuidor"] as const).map(seg => {
                  const sug = getSuggested(seg);
                  const ganancia = sug != null ? sug - costoRealTotal : null;
                  const pct = ganancia != null && sug ? (ganancia / sug) * 100 : null;
                  const ahorroVsPublico = sug != null ? precioPublicoTotal - sug : null;
                  return (
                    <div key={seg} className="bg-gray-50 rounded-xl p-3 space-y-0.5">
                      <p className="text-xs font-medium text-gray-500 capitalize">{seg}</p>
                      <p className="text-base font-bold text-gray-900">{fmt(sug)}</p>
                      <p className="text-xs text-gray-400">Margen {config.margenes[seg]}%</p>
                      {ganancia != null && (
                        <p className="text-xs text-emerald-600">+{fmt(ganancia)} ({pct?.toFixed(1)}%)</p>
                      )}
                      {ahorroVsPublico != null && ahorroVsPublico > 0 && (
                        <p className="text-xs text-blue-500">{fmt(ahorroVsPublico)} vs individual</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selector de precio de venta */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Precio de venta del combo</label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={precioManual}
                    onChange={e => {
                      setPrecioManual(e.target.checked);
                      if (!e.target.checked) setPrecioVentaInput("");
                    }}
                    className="rounded"
                  />
                  Precio manual
                </label>
              </div>

              {precioManual ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    value={precioVentaInput}
                    onChange={e => setPrecioVentaInput(e.target.value)}
                    className="w-full border border-amber-300 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              ) : costoRealTotal != null ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700">
                    {fmt(getSuggested("minorista"))} <span className="text-xs text-gray-400">(minorista auto)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmartOpen(s => !s)}
                    className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-colors"
                    title="Opciones de redondeo"
                  >
                    <Zap size={18} />
                  </button>
                </div>
              ) : null}

              {smartOpen && !precioManual && getSuggested("minorista") != null && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                    <Zap size={12} /> Opciones de redondeo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {roundOptions(getSuggested("minorista")!).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { setPrecioVentaInput(String(v)); setPrecioManual(true); setSmartOpen(false); }}
                        className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 text-sm rounded-lg font-medium transition-colors"
                      >
                        {fmt(v)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Resumen */}
            {precioEfectivo != null && costoRealTotal != null && (
              <div className="bg-emerald-50 rounded-xl p-4 grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-xs text-gray-500">Costo</p>
                  <p className="font-bold text-gray-900 text-sm">{fmt(costoRealTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Precio combo</p>
                  <p className="font-bold text-emerald-700 text-sm">{fmt(precioEfectivo)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ganancia</p>
                  <p className="font-bold text-emerald-700 text-sm">
                    {fmt(precioEfectivo - costoRealTotal)}
                    <span className="text-xs font-normal block">
                      ({((precioEfectivo - costoRealTotal) / precioEfectivo * 100).toFixed(1)}%)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ahorro vs individual</p>
                  <p className={`font-bold text-sm ${precioPublicoTotal - precioEfectivo > 0 ? "text-blue-600" : "text-gray-400"}`}>
                    {fmt(precioPublicoTotal - precioEfectivo)}
                  </p>
                </div>
              </div>
            )}

            {/* Medios de pago */}
            {precioEfectivo != null && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Precio por medio de pago</h3>
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="text-left px-3 py-2 font-medium">Medio</th>
                        <th className="text-right px-3 py-2 font-medium">Recargo</th>
                        <th className="text-right px-3 py-2 font-medium">Precio final</th>
                        {costoRealTotal != null && <th className="text-right px-3 py-2 font-medium">Ganancia</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(config.mediosPago).map(([key, fee], i) => {
                        const final = precioEfectivo * (1 + fee / 100);
                        const gan = costoRealTotal != null ? final - costoRealTotal : null;
                        return (
                          <tr key={key} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-2 text-gray-700">{MEDIO_LABELS[key] ?? key}</td>
                            <td className="px-3 py-2 text-right text-gray-400">{fee > 0 ? `+${fee}%` : "—"}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(final)}</td>
                            {costoRealTotal != null && (
                              <td className={`px-3 py-2 text-right text-xs ${gan != null && gan >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                {gan != null ? `${gan >= 0 ? "+" : ""}${fmt(gan)}` : "—"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
        >
          {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear combo"}
        </button>
      </div>
    </div>
  );
}
