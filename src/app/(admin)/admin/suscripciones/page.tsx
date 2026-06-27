"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users, CheckCircle, XCircle } from "lucide-react";

interface Suscripcion {
  id: number;
  email: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  frecuencia_dias: number;
  proximo_envio: string;
  ultimo_envio: string | null;
  estado: string;
  creado_en: string;
}

interface Resumen {
  estado: string;
  cantidad: number;
}

export default function SuscripcionesPage() {
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [resumen, setResumen] = useState<Resumen[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/suscripciones");
    const data = await res.json();
    setSuscripciones(data.suscripciones ?? []);
    setResumen(data.resumen ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleEstado(id: number, current: string) {
    const nuevo = current === "activa" ? "cancelada" : "activa";
    await fetch("/api/suscripciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado: nuevo }),
    });
    setSuscripciones((prev) => prev.map((s) => s.id === id ? { ...s, estado: nuevo } : s));
  }

  const activas = resumen.find((r) => r.estado === "activa")?.cantidad ?? 0;
  const canceladas = resumen.find((r) => r.estado === "cancelada")?.cantidad ?? 0;
  const vencenHoy = suscripciones.filter((s) => s.estado === "activa" && s.proximo_envio <= new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw size={22} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900">Suscripciones de reposición</h1>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        Los recordatorios se envían automáticamente cada día a las 9am (cron diario).
        Los clientes reciben un email con un link para comprar cuando llega la fecha programada.
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Users size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activas}</p>
            <p className="text-xs text-gray-500">Activas</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><RefreshCw size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{vencenHoy}</p>
            <p className="text-xs text-gray-500">Pendientes hoy</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-50 text-red-500"><XCircle size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{canceladas}</p>
            <p className="text-xs text-gray-500">Canceladas</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <span className="text-sm font-semibold text-gray-700">Suscripciones</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : suscripciones.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">
            Sin suscripciones aún. Aparecen cuando un cliente activa el recordatorio de reposición en un producto.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-5 py-3 text-left font-medium">Email</th>
                <th className="px-5 py-3 text-left font-medium">Producto</th>
                <th className="px-5 py-3 text-center font-medium">Cant.</th>
                <th className="px-5 py-3 text-center font-medium">Frecuencia</th>
                <th className="px-5 py-3 text-left font-medium">Próximo envío</th>
                <th className="px-5 py-3 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {suscripciones.map((s) => {
                const isVencida = s.estado === "activa" && s.proximo_envio <= new Date().toISOString().slice(0, 10);
                return (
                  <tr key={s.id} className={`border-t border-gray-50 hover:bg-gray-50 ${isVencida ? "bg-amber-50" : ""}`}>
                    <td className="px-5 py-3 text-gray-800">{s.email}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 line-clamp-1">{s.product_name}</p>
                      <p className="text-xs text-gray-400">{s.variant_name}</p>
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">{s.quantity}</td>
                    <td className="px-5 py-3 text-center text-gray-500">{s.frecuencia_dias}d</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium ${isVencida ? "text-amber-600" : "text-gray-600"}`}>
                        {s.proximo_envio}
                        {isVencida && " ⚡"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleEstado(s.id, s.estado)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          s.estado === "activa"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {s.estado === "activa" ? "Activa" : "Cancelada"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
