"use client";

import { useEffect, useState } from "react";
import { Gift, Users, RefreshCw } from "lucide-react";

interface Referido {
  id: number;
  email: string;
  codigo: string;
  usos: number;
  activo: boolean;
  creado_en: string;
  total_descuentos_otorgados: number;
}

export default function ReferidosPage() {
  const [referidos, setReferidos] = useState<Referido[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/referidos");
    setReferidos(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalReferidos = referidos.length;
  const totalUsos = referidos.reduce((s, r) => s + r.usos, 0);
  const descuentoPct = process.env.NEXT_PUBLIC_REFERIDOS_DESCUENTO_PCT ?? "10";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift size={22} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900">Programa de referidos</h1>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        Cada referidor tiene un link único. Cuando alguien compra con ese link obtiene un <strong>{descuentoPct}% de descuento</strong>.
        Configurá el porcentaje con la env var <code className="font-mono bg-blue-100 px-1 rounded">REFERIDOS_DESCUENTO_PCT</code> (default: 10).
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Users size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalReferidos}</p>
            <p className="text-xs text-gray-500">Referidores activos</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-50 text-violet-600"><Gift size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalUsos}</p>
            <p className="text-xs text-gray-500">Usos totales</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <span className="text-sm font-semibold text-gray-700">Referidores</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : referidos.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">
            Aún no hay referidores. Aparecen cuando un cliente genera su link de referido.
          </p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-5 py-3 text-left font-medium">Email</th>
                <th className="px-5 py-3 text-left font-medium">Código</th>
                <th className="px-5 py-3 text-center font-medium">Usos</th>
                <th className="px-5 py-3 text-left font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {referidos.map((r) => (
                <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-800">{r.email}</td>
                  <td className="px-5 py-3 font-mono text-xs font-bold text-emerald-700">{r.codigo}</td>
                  <td className="px-5 py-3 text-center">
                    {r.usos > 0 ? (
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{r.usos}</span>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(r.creado_en).toLocaleDateString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
