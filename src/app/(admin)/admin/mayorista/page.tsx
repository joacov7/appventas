"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Layers } from "lucide-react";

interface Tier {
  id: number;
  min_qty: number;
  descuento_pct: number;
  etiqueta: string;
  activo: boolean;
}

export default function MayoristaPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ min_qty: "", descuento_pct: "", etiqueta: "Mayorista" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/mayorista/tiers");
    setTiers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.min_qty || !form.descuento_pct) { setError("Completá todos los campos"); return; }
    setSaving(true);
    const res = await fetch("/api/mayorista/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        min_qty: Number(form.min_qty),
        descuento_pct: Number(form.descuento_pct),
        etiqueta: form.etiqueta,
      }),
    });
    if (res.ok) {
      setForm({ min_qty: "", descuento_pct: "", etiqueta: "Mayorista" });
      await load();
    } else {
      setError("Error al guardar");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await fetch("/api/mayorista/tiers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTiers((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Layers size={22} className="text-emerald-600" />
        <h1 className="text-2xl font-bold text-gray-900">Precios mayoristas</h1>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        Los descuentos por volumen se aplican automáticamente en el checkout cuando un ítem supera la cantidad mínima.
        El descuento se muestra en la página del producto y en el carrito.
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Agregar tier de precio</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cantidad mínima</label>
            <input
              type="number" min="2" required
              value={form.min_qty}
              onChange={(e) => setForm((f) => ({ ...f, min_qty: e.target.value }))}
              placeholder="ej: 10"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descuento (%)</label>
            <input
              type="number" min="1" max="99" step="0.5" required
              value={form.descuento_pct}
              onChange={(e) => setForm((f) => ({ ...f, descuento_pct: e.target.value }))}
              placeholder="ej: 10"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Etiqueta</label>
            <input
              type="text" required
              value={form.etiqueta}
              onChange={(e) => setForm((f) => ({ ...f, etiqueta: e.target.value }))}
              placeholder="Mayorista"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <div className="col-span-3">
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <button
              type="submit" disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} />
              {saving ? "Guardando…" : "Agregar tier"}
            </button>
          </div>
        </form>
      </div>

      {/* Tiers list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <span className="text-sm font-semibold text-gray-700">Tiers activos</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tiers.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">
            No hay tiers configurados. Los precios son los mismos para todos.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-5 py-3 text-left font-medium">Cantidad mínima</th>
                <th className="px-5 py-3 text-left font-medium">Descuento</th>
                <th className="px-5 py-3 text-left font-medium">Etiqueta</th>
                <th className="px-5 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id} className="border-t border-gray-50">
                  <td className="px-5 py-3 font-semibold text-gray-800">{t.min_qty}+ unidades</td>
                  <td className="px-5 py-3">
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {t.descuento_pct}% off
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{t.etiqueta}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
