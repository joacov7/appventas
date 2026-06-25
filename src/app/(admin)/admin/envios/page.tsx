"use client";

import { useState, useEffect } from "react";
import { Truck, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

interface ShippingOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  estimatedDays: string | null;
  active: boolean;
  position: number;
}

export default function EnviosPage() {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");

  useEffect(() => {
    fetch("/api/envios")
      .then((r) => r.json())
      .then(setOptions)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description: description || undefined,
          price: parseFloat(price),
          estimatedDays: estimatedDays || undefined,
          position: options.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data.error));
      setOptions([...options, data]);
      setShowForm(false);
      setName(""); setDescription(""); setPrice(""); setEstimatedDays("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta opción de envío?")) return;
    await fetch(`/api/envios/${id}`, { method: "DELETE" });
    setOptions(options.filter((o) => o.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Opciones de envío</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Nueva opción
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Crear opción de envío</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="ej: Correo Argentino, Retiro en local"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="ej: Envío a domicilio en todo el país"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio (ARS) *</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min="0"
                placeholder="0 = gratis"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo estimado</label>
              <input value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)}
                placeholder="ej: 3 a 5 días hábiles"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={saving}>Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400">Cargando...</div>
        ) : options.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400">
            No hay opciones de envío. Agregá la primera.
          </div>
        ) : options.map((opt) => (
          <div key={opt.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
            <div className="bg-emerald-50 p-2 rounded-xl">
              <Truck size={20} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{opt.name}</p>
              {opt.description && <p className="text-sm text-gray-500">{opt.description}</p>}
              {opt.estimatedDays && <p className="text-xs text-gray-400 mt-0.5">{opt.estimatedDays}</p>}
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">
                {Number(opt.price) === 0 ? "Gratis" : formatPrice(Number(opt.price))}
              </p>
            </div>
            <button onClick={() => handleDelete(opt.id)}
              className="text-gray-400 hover:text-red-500 transition-colors ml-2">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
