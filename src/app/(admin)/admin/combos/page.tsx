"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

interface Combo {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  precio_venta: number | null;
  items: { id: number; product_id: string; quantity: number }[];
}

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await fetch("/api/combos").then(r => r.json());
    setCombos(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function del(id: string, name: string) {
    if (!confirm(`¿Eliminar combo "${name}"?`)) return;
    await fetch(`/api/combos/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="text-gray-400 py-12 text-center">Cargando...</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Combos</h1>
        <Link
          href="/admin/combos/nuevo"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> Nuevo combo
        </Link>
      </div>

      {combos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <Package size={40} className="mx-auto text-gray-200 mb-3" strokeWidth={1} />
          <p className="text-gray-400 text-sm">No hay combos todavía.</p>
          <Link href="/admin/combos/nuevo" className="mt-3 inline-block text-sm text-emerald-600 hover:underline">
            Crear el primero
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {combos.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                  {!c.active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {c.items.length} producto{c.items.length !== 1 ? "s" : ""}
                  {c.precio_venta != null && (
                    <> · <span className="text-emerald-600 font-medium">${Number(c.precio_venta).toLocaleString("es-AR")}</span></>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/combos/${c.id}/editar`}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Pencil size={15} />
                </Link>
                <button
                  onClick={() => del(c.id, c.name)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
