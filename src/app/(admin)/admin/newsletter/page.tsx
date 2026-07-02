"use client";

import { useEffect, useState } from "react";
import { Mail, Users, UserX, Send, RefreshCw } from "lucide-react";

interface Suscriptor {
  id: number;
  email: string;
  nombre: string | null;
  estado: string;
  cupon_code: string | null;
  creado_en: string;
}

interface Resumen {
  estado: string;
  cantidad: number;
}

export default function NewsletterPage() {
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [resumen, setResumen] = useState<Resumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [reactivacionStatus, setReactivacionStatus] = useState<string | null>(null);
  const [reactivacionLoading, setReactivacionLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/newsletter/admin");
    const data = await res.json();
    setSuscriptores(data.suscriptores ?? []);
    setResumen(data.resumen ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleEstado(id: number, current: string) {
    const nuevo = current === "activo" ? "baja" : "activo";
    await fetch("/api/newsletter/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado: nuevo }),
    });
    setSuscriptores((prev) =>
      prev.map((s) => s.id === id ? { ...s, estado: nuevo } : s)
    );
  }

  async function triggerReactivacion() {
    setReactivacionLoading(true);
    setReactivacionStatus(null);
    try {
      const res = await fetch("/api/newsletter/reactivacion", { method: "POST" });
      const data = await res.json();
      setReactivacionStatus(`Enviados: ${data.sent} de ${data.total ?? 0} clientes inactivos`);
    } catch {
      setReactivacionStatus("Error al enviar");
    } finally {
      setReactivacionLoading(false);
    }
  }

  const activos = resumen.find((r) => r.estado === "activo")?.cantidad ?? 0;
  const bajas = resumen.find((r) => r.estado === "baja")?.cantidad ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Newsletter</h1>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Users size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activos}</p>
            <p className="text-xs text-gray-500">Suscriptores activos</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-50 text-red-500"><UserX size={20} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{bajas}</p>
            <p className="text-xs text-gray-500">Dados de baja</p>
          </div>
        </div>
        {/* Reactivation trigger */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-700">Campaña de reactivación</p>
          <p className="text-xs text-gray-400">Envía cupón 15% a clientes sin comprar en 30–90 días</p>
          <button
            onClick={triggerReactivacion}
            disabled={reactivacionLoading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Send size={13} />
            {reactivacionLoading ? "Enviando…" : "Enviar ahora"}
          </button>
          {reactivacionStatus && <p className="text-xs text-gray-500">{reactivacionStatus}</p>}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
          <Mail size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Suscriptores</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-300">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : suscriptores.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">Sin suscriptores aún</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-5 py-3 text-left font-medium">Email</th>
                <th className="px-5 py-3 text-left font-medium">Nombre</th>
                <th className="px-5 py-3 text-left font-medium">Cupón</th>
                <th className="px-5 py-3 text-left font-medium">Fecha</th>
                <th className="px-5 py-3 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {suscriptores.map((s) => (
                <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-800">{s.email}</td>
                  <td className="px-5 py-3 text-gray-500">{s.nombre ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-emerald-700">{s.cupon_code ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(s.creado_en).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleEstado(s.id, s.estado)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.estado === "activo"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {s.estado === "activo" ? "Activo" : "Baja"}
                    </button>
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
