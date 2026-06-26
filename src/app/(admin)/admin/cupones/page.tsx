"use client";

import { useState, useEffect } from "react";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

interface Coupon {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minAmount: number | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
  expiresAt: string | null;
}

export default function CuponesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    fetch("/api/cupones").then((r) => r.json()).then(setCoupons).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/cupones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code, type, value: parseFloat(value),
          minAmount: minAmount ? parseFloat(minAmount) : undefined,
          maxUses: maxUses ? parseInt(maxUses) : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data.error));
      setCoupons([data, ...coupons]);
      setShowForm(false);
      setCode(""); setValue(""); setMinAmount(""); setMaxUses(""); setExpiresAt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cupones de descuento</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Nuevo cupón
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Crear cupón</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required
                placeholder="VERANO20"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="PERCENT">Porcentaje (%)</option>
                <option value="FIXED">Monto fijo ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor * {type === "PERCENT" ? "(%)" : "(ARS)"}
              </label>
              <input type="number" value={value} onChange={(e) => setValue(e.target.value)} required min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto mínimo (ARS)</label>
              <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usos máximos</label>
              <input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} min="1"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vence el</label>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={creating}>Crear cupón</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Cargando...</div>
        ) : coupons.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No hay cupones aún.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Código", "Descuento", "Mín.", "Usos", "Vence", "Estado"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900 flex items-center gap-2">
                    <Tag size={14} className="text-emerald-500" /> {c.code}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.type === "PERCENT" ? `${c.value}%` : formatPrice(c.value)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.minAmount ? formatPrice(Number(c.minAmount)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.uses}{c.maxUses ? `/${c.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("es-AR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {c.active ? "Activo" : "Inactivo"}
                    </span>
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
