"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Layers, DollarSign, Pencil, Check, X, AlertTriangle } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Tier {
  id: number;
  tipo: "cantidad" | "monto";
  min_qty: number | null;
  min_monto: number | null;
  descuento_pct: number;
  etiqueta: string;
  activo: boolean;
}

interface EditState {
  min_qty: string;
  min_monto: string;
  descuento_pct: string;
  etiqueta: string;
}

const EMPTY_FORM = { min_qty: "", min_monto: "", descuento_pct: "", etiqueta: "Mayorista" };

export default function MayoristaPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<"cantidad" | "monto" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/mayorista/tiers");
    const data: Tier[] = await res.json();
    setTiers(data);
    if (data.length > 0) setSelectedTipo(data[0].tipo);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // The active mode: from existing tiers if any, otherwise what the user selected
  const activeTipo: "cantidad" | "monto" | null = tiers.length > 0 ? tiers[0].tipo : selectedTipo;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.descuento_pct) { setError("Ingresá el descuento"); return; }
    if (activeTipo === "cantidad" && !form.min_qty) { setError("Ingresá la cantidad mínima"); return; }
    if (activeTipo === "monto" && !form.min_monto) { setError("Ingresá el monto mínimo"); return; }
    setSaving(true);
    const res = await fetch("/api/mayorista/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: activeTipo,
        min_qty: activeTipo === "cantidad" ? Number(form.min_qty) : null,
        min_monto: activeTipo === "monto" ? Number(form.min_monto) : null,
        descuento_pct: Number(form.descuento_pct),
        etiqueta: form.etiqueta,
      }),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      await load();
    } else {
      const data = await res.json();
      setError(data?.error ?? "Error al guardar");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await fetch("/api/mayorista/tiers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTiers((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) setSelectedTipo(null);
      return next;
    });
  }

  function startEdit(t: Tier) {
    setEditId(t.id);
    setEditState({
      min_qty: t.min_qty != null ? String(t.min_qty) : "",
      min_monto: t.min_monto != null ? String(t.min_monto) : "",
      descuento_pct: String(t.descuento_pct),
      etiqueta: t.etiqueta,
    });
  }

  async function saveEdit(tier: Tier) {
    setEditSaving(true);
    await fetch("/api/mayorista/tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: tier.id,
        min_qty: tier.tipo === "cantidad" && editState.min_qty ? Number(editState.min_qty) : undefined,
        min_monto: tier.tipo === "monto" && editState.min_monto ? Number(editState.min_monto) : undefined,
        descuento_pct: editState.descuento_pct ? Number(editState.descuento_pct) : undefined,
        etiqueta: editState.etiqueta || undefined,
      }),
    });
    setEditId(null);
    await load();
    setEditSaving(false);
  }

  async function handleSwitchMode() {
    // Delete all tiers then let user pick new mode
    await Promise.all(tiers.map((t) =>
      fetch("/api/mayorista/tiers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id }),
      })
    ));
    setTiers([]);
    setSelectedTipo(null);
    setShowSwitchConfirm(false);
  }

  const isQty = activeTipo === "cantidad";
  const accent = isQty ? "emerald" : "blue";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isQty ? <Layers size={22} className="text-emerald-600" /> : <DollarSign size={22} className="text-blue-600" />}
          <h1 className="text-2xl font-bold text-gray-900">Precios mayoristas</h1>
        </div>
        {activeTipo && !showSwitchConfirm && (
          <button
            onClick={() => setShowSwitchConfirm(true)}
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Cambiar a {isQty ? "por monto" : "por cantidad"}
          </button>
        )}
      </div>

      {/* Switch confirm */}
      {showSwitchConfirm && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">¿Eliminar todos los tiers actuales?</p>
            <p className="text-xs text-orange-600 mt-0.5">
              Para cambiar el tipo de descuento hay que borrar los {tiers.length} tier{tiers.length !== 1 ? "s" : ""} existentes.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleSwitchMode} className="text-xs font-semibold bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600">
              Confirmar
            </button>
            <button onClick={() => setShowSwitchConfirm(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tipo selector (only when no tiers yet) */}
      {!activeTipo && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <p className="text-sm font-semibold text-gray-700">¿Cómo querés aplicar el descuento mayorista?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedTipo("cantidad")}
              className="flex flex-col items-center gap-2 border-2 border-emerald-200 bg-emerald-50 rounded-xl p-4 hover:border-emerald-400 transition-colors"
            >
              <Layers size={24} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Por cantidad</span>
              <span className="text-xs text-gray-500 text-center">Ej: desde 10 unidades → 15% OFF</span>
            </button>
            <button
              onClick={() => setSelectedTipo("monto")}
              className="flex flex-col items-center gap-2 border-2 border-blue-200 bg-blue-50 rounded-xl p-4 hover:border-blue-400 transition-colors"
            >
              <DollarSign size={24} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Por monto</span>
              <span className="text-xs text-gray-500 text-center">Ej: desde $50.000 → 15% OFF</span>
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {activeTipo && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            {isQty
              ? <><Layers size={15} className="text-emerald-600" /><span className="text-sm font-semibold text-gray-700">Agregar tier — descuento por cantidad</span></>
              : <><DollarSign size={15} className="text-blue-600" /><span className="text-sm font-semibold text-gray-700">Agregar tier — descuento por monto</span></>
            }
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {isQty ? (
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
              ) : (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Monto mínimo ($)</label>
                  <input
                    type="number" min="1" required
                    value={form.min_monto}
                    onChange={(e) => setForm((f) => ({ ...f, min_monto: e.target.value }))}
                    placeholder="ej: 50000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Descuento (%)</label>
                <input
                  type="number" min="1" max="99" step="0.5" required
                  value={form.descuento_pct}
                  onChange={(e) => setForm((f) => ({ ...f, descuento_pct: e.target.value }))}
                  placeholder="ej: 15"
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
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit" disabled={saving}
              className={`flex items-center gap-2 ${isQty ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"} disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors`}
            >
              <Plus size={15} />
              {saving ? "Guardando…" : "Agregar tier"}
            </button>
          </form>
        </div>
      )}

      {/* Tiers table */}
      {activeTipo && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className={`px-6 py-4 border-b border-gray-50 flex items-center gap-2 ${isQty ? "bg-emerald-50" : "bg-blue-50"}`}>
            {isQty
              ? <><Layers size={15} className="text-emerald-600" /><span className="text-sm font-semibold text-emerald-700">Tiers por cantidad</span></>
              : <><DollarSign size={15} className="text-blue-600" /><span className="text-sm font-semibold text-blue-700">Tiers por monto</span></>
            }
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className={`w-5 h-5 border-2 ${isQty ? "border-emerald-500" : "border-blue-500"} border-t-transparent rounded-full animate-spin`} />
            </div>
          ) : tiers.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Todavía no hay tiers. Agregá uno arriba.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">{isQty ? "Cantidad mínima" : "Monto mínimo"}</th>
                  <th className="px-5 py-3 text-left font-medium">Descuento</th>
                  <th className="px-5 py-3 text-left font-medium">Etiqueta</th>
                  <th className="px-5 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    {editId === t.id ? (
                      <>
                        <td className="px-4 py-2">
                          {isQty ? (
                            <input
                              type="number" min="2"
                              value={editState.min_qty}
                              onChange={(e) => setEditState((s) => ({ ...s, min_qty: e.target.value }))}
                              className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-400"
                            />
                          ) : (
                            <input
                              type="number" min="1"
                              value={editState.min_monto}
                              onChange={(e) => setEditState((s) => ({ ...s, min_monto: e.target.value }))}
                              className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-400"
                            />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number" min="1" max="99" step="0.5"
                            value={editState.descuento_pct}
                            onChange={(e) => setEditState((s) => ({ ...s, descuento_pct: e.target.value }))}
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-400"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editState.etiqueta}
                            onChange={(e) => setEditState((s) => ({ ...s, etiqueta: e.target.value }))}
                            className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-400"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => saveEdit(t)}
                              disabled={editSaving}
                              className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                            >
                              <Check size={16} />
                            </button>
                            <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 font-semibold text-gray-800">
                          {isQty ? `${t.min_qty}+ unidades` : `Desde ${formatPrice(t.min_monto ?? 0)}`}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`${isQty ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"} text-xs font-bold px-2 py-0.5 rounded-full`}>
                            {t.descuento_pct}% off
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500">{t.etiqueta}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => startEdit(t)} className="text-gray-300 hover:text-gray-600 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
