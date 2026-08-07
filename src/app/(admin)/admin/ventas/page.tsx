"use client";

import { useEffect, useState } from "react";
import { Receipt, Plus, RefreshCw, Trash2, X, Check } from "lucide-react";

interface Venta {
  id: number; cliente_nombre: string | null; cliente_email: string | null; cliente_telefono: string | null;
  canal: string; total: number; origen: string; fecha: string;
}

const CANALES = [
  { k: "mostrador", label: "Mostrador" }, { k: "whatsapp", label: "WhatsApp" },
  { k: "instagram", label: "Instagram" }, { k: "mayorista", label: "Mayorista" }, { k: "otro", label: "Otro" },
];
const money = (n: number) => "$" + Math.round(Number(n)).toLocaleString("es-AR");
const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const VACIA = { cliente_nombre: "", cliente_email: "", cliente_telefono: "", canal: "mostrador", total: "", fecha: "" };

export default function VentasPage() {
  const [items, setItems] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/ventas");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function guardar() {
    if (!(Number(form.total) > 0)) { setError("Poné un total mayor a 0"); return; }
    setGuardando(true); setError(null);
    const r = await fetch("/api/ventas", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setGuardando(false);
    if (r.ok) { setForm(null); await load(); }
    else setError((await r.json()).error ?? "Error al guardar");
  }
  async function eliminar(id: number) {
    if (!confirm("¿Eliminar esta venta?")) return;
    await fetch(`/api/ventas?id=${id}`, { method: "DELETE" });
    setItems(prev => prev.filter(v => v.id !== id));
  }

  const totalMes = items
    .filter(v => new Date(v.fecha + "T00:00:00").getMonth() === new Date().getMonth())
    .reduce((a, v) => a + Number(v.total), 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ventas manuales</h1>
            <p className="text-sm text-gray-500">Cargá ventas por WhatsApp, mostrador o mayorista. Suman en Finanzas y Postventa.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
          <button onClick={() => { setForm({ ...VACIA }); setError(null); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Plus size={16} /> Cargar venta
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-2xl font-bold text-gray-900">{money(totalMes)}</p>
        <p className="text-xs text-gray-500">Ventas manuales de este mes</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Receipt className="mx-auto text-gray-300 mb-3" size={32} />
          <p className="text-gray-500 text-sm">No cargaste ventas manuales todavía. Usá “Cargar venta”.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(v => (
            <div key={v.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-gray-900 text-sm">{v.cliente_nombre || "Sin nombre"}</h3>
                  <span className="text-xs bg-gray-50 border text-gray-500 px-2 py-0.5 rounded capitalize">{v.canal}</span>
                  {v.origen === "presupuesto" && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">de presupuesto</span>}
                  <span className="text-xs text-gray-400">{fmt(v.fecha)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{[v.cliente_telefono, v.cliente_email].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-indigo-600">{money(v.total)}</span>
                <button onClick={() => eliminar(v.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-gray-900">Cargar venta</h2>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cliente" value={form.cliente_nombre} onChange={(v: string) => setForm({ ...form, cliente_nombre: v })} />
                <div>
                  <label className="text-xs text-gray-500">Canal</label>
                  <select value={form.canal} onChange={e => setForm({ ...form, canal: e.target.value })}
                    className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none bg-white">
                    {CANALES.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}
                  </select>
                </div>
                <Field label="Teléfono" value={form.cliente_telefono} onChange={(v: string) => setForm({ ...form, cliente_telefono: v })} />
                <Field label="Email" value={form.cliente_email} onChange={(v: string) => setForm({ ...form, cliente_email: v })} />
                <div>
                  <label className="text-xs text-gray-500">Total *</label>
                  <input type="number" step="0.01" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })}
                    className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                    className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <button onClick={() => setForm(null)} className="text-sm text-gray-500 px-4 py-2">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
                <Check size={16} /> {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
    </div>
  );
}
