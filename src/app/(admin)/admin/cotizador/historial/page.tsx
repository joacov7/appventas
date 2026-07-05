"use client";

import { useEffect, useState } from "react";
import { FileText, RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Presupuesto {
  id: number;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  canal: string;
  medio_pago: string | null;
  items: { nombre: string; cantidad: number }[];
  subtotal: number;
  descuento_pct: number;
  total: number;
  estado: string;
  creado_en: string;
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  borrador:  { label: "Borrador",  color: "bg-gray-100 text-gray-600" },
  enviado:   { label: "Enviado",   color: "bg-blue-100 text-blue-700" },
  aceptado:  { label: "Aceptado",  color: "bg-emerald-100 text-emerald-700" },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-600" },
};

function money(n: number) { return "$" + Math.round(Number(n)).toLocaleString("es-AR"); }
function fmt(s: string) { return new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }

export default function HistorialPresupuestosPage() {
  const [items, setItems] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/cotizador/presupuestos");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function cambiarEstado(id: number, estado: string) {
    setItems(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    await fetch("/api/cotizador/presupuestos", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, estado }),
    });
  }
  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    await fetch(`/api/cotizador/presupuestos?id=${id}`, { method: "DELETE" });
    setItems(prev => prev.filter(p => p.id !== id));
  }

  const totalAceptado = items.filter(p => p.estado === "aceptado").reduce((a, p) => a + Number(p.total), 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Historial de presupuestos</h1>
            <p className="text-sm text-gray-500">Seguimiento de lo cotizado y su estado.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/cotizador" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={15} /> Cotizador
          </Link>
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-2xl font-bold text-gray-900">{items.length}</p><p className="text-xs text-gray-500">Presupuestos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-2xl font-bold text-emerald-600">{money(totalAceptado)}</p><p className="text-xs text-gray-500">Aceptado</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <FileText className="mx-auto text-gray-300 mb-3" size={32} />
          <p className="text-gray-500 text-sm">Todavía no guardaste presupuestos. Armá uno en el Cotizador y tocá “Guardar en historial”.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{p.cliente_empresa || p.cliente_nombre || "Sin cliente"}</h3>
                    <span className="text-xs text-gray-400">{fmt(p.creado_en)}</span>
                    <span className="text-xs bg-gray-50 border text-gray-500 px-2 py-0.5 rounded-md">{p.canal}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {p.items.map(i => `${i.cantidad}× ${i.nombre}`).join(" · ")}
                  </p>
                  <p className="text-lg font-bold text-indigo-600 mt-1">{money(p.total)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <select value={p.estado} onChange={e => cambiarEstado(p.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-medium outline-none ${ESTADOS[p.estado]?.color ?? "bg-gray-100"}`}>
                    {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button onClick={() => eliminar(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
