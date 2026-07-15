"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageCheck, RefreshCw } from "lucide-react";

interface Pedido {
  order_id: string; cliente: string; ciudad: string | null; total: number;
  items: number; creado: string; estado: string; armador: string | null;
}

const ESTADO: Record<string, { label: string; cls: string }> = {
  para_armar: { label: "Para armar", cls: "bg-blue-100 text-blue-700" },
  armando: { label: "En armado", cls: "bg-amber-100 text-amber-700" },
  listo: { label: "Listo", cls: "bg-emerald-100 text-emerald-700" },
  con_faltante: { label: "Con faltante", cls: "bg-red-100 text-red-700" },
  despachado: { label: "Despachado", cls: "bg-gray-100 text-gray-500" },
};

function fecha(s: string) {
  return new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function DepositoPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    setLoading(true);
    const r = await fetch("/api/deposito");
    if (r.ok) setPedidos(await r.json());
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  const paraArmar = pedidos.filter(p => p.estado === "para_armar" || p.estado === "armando");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <PackageCheck className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Depósito</h1>
          <p className="text-sm text-gray-500">Pedidos para armar. {paraArmar.length > 0 && <span className="text-amber-600 font-medium">{paraArmar.length} pendiente(s).</span>}</p>
        </div>
        <button onClick={cargar} className="ml-auto p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PackageCheck size={40} strokeWidth={1} className="mx-auto mb-3" />
          <p>No hay pedidos para armar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pedidos.map(p => {
            const est = ESTADO[p.estado] ?? ESTADO.para_armar;
            return (
              <Link key={p.order_id} href={`/admin/deposito/${p.order_id}`}
                className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:border-emerald-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{p.cliente}</span>
                    {p.ciudad && <span className="text-xs text-gray-400">{p.ciudad}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${est.cls}`}>{est.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {p.items} artículo(s) · #{p.order_id.slice(0, 8)} · {fecha(p.creado)}
                    {p.armador && ` · arma: ${p.armador}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900 text-sm">${Math.round(p.total).toLocaleString("es-AR")}</p>
                  <span className="text-xs text-emerald-600 font-medium">{p.estado === "armando" ? "Continuar →" : "Armar →"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
