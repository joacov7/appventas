"use client";

import { useEffect, useState } from "react";
import { Factory, Plus, RefreshCw, Trash2, Pencil, X, Check, Package } from "lucide-react";

interface Fabricante {
  id: number;
  nombre: string;
  contacto_nombre: string | null;
  whatsapp: string | null;
  email: string | null;
  sitio_web: string | null;
  margen_pct: number;
  descuento_b2b_pct: number;
  recargo_medios_pago_pct: number;
  moneda: "ARS" | "USD";
  notas: string | null;
  activo: boolean;
  productos: number;
}

const VACIO: Partial<Fabricante> = {
  nombre: "", contacto_nombre: "", whatsapp: "", email: "", sitio_web: "",
  margen_pct: 0, descuento_b2b_pct: 0, recargo_medios_pago_pct: 0,
  moneda: "ARS", notas: "", activo: true,
};

export default function FabricantesPage() {
  const [items, setItems] = useState<Fabricante[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Partial<Fabricante> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/fabricantes");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function guardar() {
    if (!editando?.nombre?.trim()) { setError("El nombre es obligatorio"); return; }
    setGuardando(true); setError(null);
    const r = await fetch("/api/fabricantes", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editando),
    });
    setGuardando(false);
    if (r.ok) { setEditando(null); await load(); }
    else setError((await r.json()).error ?? "Error al guardar");
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este fabricante? Se quitan también sus productos asociados.")) return;
    await fetch(`/api/fabricantes?id=${id}`, { method: "DELETE" });
    await load();
  }

  function campo(k: keyof Fabricante, v: any) { setEditando(p => ({ ...p, [k]: v })); }

  const activos = items.filter(f => f.activo).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Factory className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fabricantes</h1>
            <p className="text-sm text-gray-500">Proveedores y sus reglas de precio, configurables sin tocar código.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
          <button onClick={() => { setEditando({ ...VACIO }); setError(null); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600"><Factory size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{activos}</p><p className="text-xs text-gray-500">Fabricantes activos</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Package size={20} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{items.reduce((a, f) => a + (f.productos ?? 0), 0)}</p><p className="text-xs text-gray-500">Productos asociados</p></div>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Factory className="mx-auto text-gray-300 mb-3" size={32} />
          <p className="text-gray-500 text-sm">Todavía no cargaste fabricantes. Creá el primero con “Nuevo”.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(f => (
            <div key={f.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${!f.activo ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{f.nombre}</h3>
                    <span className="text-xs bg-gray-50 border text-gray-500 px-2 py-0.5 rounded-md">{f.moneda}</span>
                    {!f.activo && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-md">Inactivo</span>}
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Package size={11} /> {f.productos} productos</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    {f.contacto_nombre && <span>👤 {f.contacto_nombre}</span>}
                    {f.whatsapp && <span>📱 {f.whatsapp}</span>}
                    {f.email && <span>✉️ {f.email}</span>}
                    {f.sitio_web && <span>🌐 {f.sitio_web}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Regla label="Margen" val={f.margen_pct} />
                    <Regla label="Desc. B2B" val={f.descuento_b2b_pct} />
                    <Regla label="Recargo medios pago" val={f.recargo_medios_pago_pct} />
                  </div>
                  {f.notas && <p className="text-xs text-gray-400 mt-2 italic">{f.notas}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditando(f); setError(null); }} className="p-2 text-gray-400 hover:text-indigo-600"><Pencil size={15} /></button>
                  <button onClick={() => eliminar(f.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEditando(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">{editando.id ? "Editar fabricante" : "Nuevo fabricante"}</h2>
              <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <Input label="Nombre *" value={editando.nombre ?? ""} onChange={v => campo("nombre", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Contacto" value={editando.contacto_nombre ?? ""} onChange={v => campo("contacto_nombre", v)} />
                <Input label="WhatsApp" value={editando.whatsapp ?? ""} onChange={v => campo("whatsapp", v)} />
                <Input label="Email" value={editando.email ?? ""} onChange={v => campo("email", v)} />
                <Input label="Sitio web" value={editando.sitio_web ?? ""} onChange={v => campo("sitio_web", v)} />
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-gray-600 mb-3">Reglas de precio (porcentajes)</p>
                <div className="grid grid-cols-3 gap-3">
                  <InputNum label="Margen %" value={editando.margen_pct ?? 0} onChange={v => campo("margen_pct", v)} />
                  <InputNum label="Desc. B2B %" value={editando.descuento_b2b_pct ?? 0} onChange={v => campo("descuento_b2b_pct", v)} />
                  <InputNum label="Recargo m. pago %" value={editando.recargo_medios_pago_pct ?? 0} onChange={v => campo("recargo_medios_pago_pct", v)} />
                </div>
                <div className="mt-3">
                  <label className="text-xs text-gray-500">Moneda</label>
                  <select value={editando.moneda ?? "ARS"} onChange={e => campo("moneda", e.target.value)}
                    className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none bg-white">
                    <option value="ARS">ARS (pesos)</option>
                    <option value="USD">USD (dólares)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500">Notas</label>
                <textarea value={editando.notas ?? ""} onChange={e => campo("notas", e.target.value)} rows={2}
                  className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none resize-none" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={editando.activo !== false} onChange={e => campo("activo", e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                Activo
              </label>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t sticky bottom-0 bg-white">
              <button onClick={() => setEditando(null)} className="text-sm text-gray-500 px-4 py-2">Cancelar</button>
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

function Regla({ label, val }: { label: string; val: number }) {
  return (
    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
      {label}: <span className="font-semibold">{Number(val ?? 0)}%</span>
    </span>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
    </div>
  );
}

function InputNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input type="number" step="0.01" value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
    </div>
  );
}
