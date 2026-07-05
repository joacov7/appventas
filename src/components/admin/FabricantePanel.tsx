"use client";

import { useEffect, useState, useCallback } from "react";
import { Factory, Check } from "lucide-react";

interface FabricanteOpt { id: number; nombre: string; moneda: string; margen_pct: number }
interface Asociacion {
  fabricante_id: number;
  costo_proveedor: number | null;
  codigo_proveedor: string | null;
  fabricante_nombre?: string;
}

// Panel autónomo: lee y guarda la asociación producto→fabricante por su cuenta,
// sin depender del guardado principal del producto.
export function FabricantePanel({ productId }: { productId: string }) {
  const [fabricantes, setFabricantes] = useState<FabricanteOpt[]>([]);
  const [fabId, setFabId] = useState<string>("");
  const [costo, setCosto] = useState<string>("");
  const [codigo, setCodigo] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/productos/${productId}/fabricante`);
    if (!r.ok) return;
    const data = await r.json();
    setFabricantes(data.fabricantes ?? []);
    const a: Asociacion | null = data.asociacion;
    if (a) {
      setFabId(String(a.fabricante_id));
      setCosto(a.costo_proveedor == null ? "" : String(a.costo_proveedor));
      setCodigo(a.codigo_proveedor ?? "");
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  async function guardar() {
    setSaving(true); setOk(false);
    const r = await fetch(`/api/productos/${productId}/fabricante`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fabricante_id: fabId || null, costo_proveedor: costo, codigo_proveedor: codigo }),
    });
    setSaving(false);
    if (r.ok) { setOk(true); setTimeout(() => setOk(false), 2000); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Factory className="text-indigo-600" size={18} />
        <h3 className="font-semibold text-gray-900">Fabricante / proveedor</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">De quién viene este producto. Lo usa el Cotizador para calcular precios.</p>

      {fabricantes.length === 0 ? (
        <p className="text-sm text-gray-400">
          No hay fabricantes cargados todavía. Creá uno en <a href="/admin/fabricantes" className="text-indigo-600 hover:underline">Fabricantes</a>.
        </p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs text-gray-500">Fabricante</label>
            <select value={fabId} onChange={e => setFabId(e.target.value)}
              className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none bg-white">
              <option value="">— Sin asignar —</option>
              {fabricantes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Costo del proveedor</label>
            <input type="number" step="0.01" value={costo} onChange={e => setCosto(e.target.value)}
              placeholder="0.00" disabled={!fabId}
              className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none disabled:bg-gray-50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Código del proveedor</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)}
              placeholder="SKU proveedor" disabled={!fabId}
              className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none disabled:bg-gray-50" />
          </div>
        </div>
      )}

      {fabricantes.length > 0 && (
        <div className="flex justify-end mt-4">
          <button onClick={guardar} disabled={saving}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Check size={16} /> {saving ? "Guardando..." : ok ? "Guardado ✓" : "Guardar fabricante"}
          </button>
        </div>
      )}
    </div>
  );
}
