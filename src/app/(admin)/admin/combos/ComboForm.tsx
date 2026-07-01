"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Zap, TrendingUp, Check } from "lucide-react";
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

function fmt(n: number | null) {
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

  function getProduct(id: string) {
    return products.find(p => p.id === id);
  }

  function getVariant(productId: string, variantId: string) {
    return getProduct(productId)?.variants.find(v => v.id === variantId) ?? null;
  }

  function getVariantPrice(item: ComboItem): number {
    const v = getVariant(item.product_id, item.variant_id);
    return v ? Number(v.price) : 0;
  }

  const costoTotal = items.reduce((sum, item) => sum + getVariantPrice(item) * item.quantity, 0);

  function getSuggested(seg: "minorista" | "mayorista" | "distribuidor") {
    if (!costoTotal || !config) return null;
    return costoTotal / (1 - config.margenes[seg] / 100);
  }

  const precioEfectivo = precioManual
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
    const body = {
      name, slug, description, image_urls: imageUrls, active,
      precio_venta: precioManual ? (parseFloat(precioVentaInput) || null) : (precioEfectivo ? Math.round(precioEfectivo) : null),
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
              <Plus size={14} /> Agregar producto
            </button>
          </div>

          {items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Agregá productos para armar el combo.</p>
          )}

          {items.map((item, i) => {
            const p = getProduct(item.product_id);
            const v = p?.variants.find(v => v.id === item.variant_id);
            const lineTotal = (v ? Number(v.price) : 0) * item.quantity;
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

                    <div className="flex items-center gap-3">
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
                      <div className="mt-4 text-sm text-gray-500">
                        {v ? `${fmt(Number(v.price))} × ${item.quantity} = ` : ""}<span className="font-semibold text-gray-800">{fmt(lineTotal)}</span>
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
            <div className="flex justify-between items-center px-1 pt-1 border-t border-gray-100">
              <span className="text-sm font-medium text-gray-600">Costo total del combo</span>
              <span className="text-base font-bold text-gray-900">{fmt(costoTotal)}</span>
            </div>
          )}
        </div>

        {/* Panel de precios */}
        {costoTotal > 0 && config && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" />
              <h2 className="font-semibold text-gray-900">Precio inteligente</h2>
            </div>

            {/* Indicadores por segmento */}
            <div className="grid grid-cols-3 gap-3">
              {(["minorista", "mayorista", "distribuidor"] as const).map(seg => {
                const sug = getSuggested(seg);
                const ganancia = sug ? sug - costoTotal : null;
                const pct = ganancia && sug ? (ganancia / sug) * 100 : null;
                return (
                  <div key={seg} className="bg-gray-50 rounded-xl p-3 space-y-0.5">
                    <p className="text-xs font-medium text-gray-500 capitalize">{seg}</p>
                    <p className="text-base font-bold text-gray-900">{fmt(sug)}</p>
                    <p className="text-xs text-gray-400">Margen {config.margenes[seg]}%</p>
                    {ganancia != null && (
                      <p className="text-xs text-emerald-600">+{fmt(ganancia)} ({pct?.toFixed(1)}%)</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Precio de venta */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Precio de venta</label>
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
              ) : (
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
              )}

              {smartOpen && !precioManual && getSuggested("minorista") && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                    <Zap size={12} /> Opciones de redondeo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {roundOptions(getSuggested("minorista")!).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setPrecioVentaInput(String(v));
                          setPrecioManual(true);
                          setSmartOpen(false);
                        }}
                        className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 text-sm rounded-lg font-medium transition-colors"
                      >
                        {fmt(v)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Resumen de ganancia */}
            {precioEfectivo && (
              <div className="bg-emerald-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-gray-500">Costo</p>
                  <p className="font-bold text-gray-900">{fmt(costoTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Precio venta</p>
                  <p className="font-bold text-emerald-700">{fmt(precioEfectivo)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ganancia</p>
                  <p className="font-bold text-emerald-700">
                    {fmt(precioEfectivo - costoTotal)}
                    <span className="text-xs font-normal ml-1">
                      ({((precioEfectivo - costoTotal) / precioEfectivo * 100).toFixed(1)}%)
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Medios de pago */}
            {precioEfectivo && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Precio por medio de pago</h3>
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="text-left px-3 py-2 font-medium">Medio</th>
                        <th className="text-right px-3 py-2 font-medium">Recargo</th>
                        <th className="text-right px-3 py-2 font-medium">Precio final</th>
                        <th className="text-right px-3 py-2 font-medium">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(config.mediosPago).map(([key, fee], i) => {
                        const final = precioEfectivo * (1 + fee / 100);
                        const gan = final - costoTotal;
                        return (
                          <tr key={key} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-2 text-gray-700">{MEDIO_LABELS[key] ?? key}</td>
                            <td className="px-3 py-2 text-right text-gray-400">{fee > 0 ? `+${fee}%` : "—"}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(final)}</td>
                            <td className={`px-3 py-2 text-right text-xs ${gan >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {gan >= 0 ? "+" : ""}{fmt(gan)}
                            </td>
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
