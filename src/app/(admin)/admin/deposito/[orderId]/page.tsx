"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, AlertTriangle, Printer, Truck, PackageCheck } from "lucide-react";

interface Item {
  order_item_id: string; producto: string; variante: string | null;
  pedido: number; controlado: number; faltante: number;
}
interface Prep {
  order_id: string; estado: string; armador: string | null; cliente: string;
  direccion: any; email: string | null; notas: string | null;
  items: Item[]; completo: boolean; hayFaltante: boolean;
}

export default function ArmarPedidoPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [prep, setPrep] = useState<Prep | null>(null);
  const [armador, setArmador] = useState("");
  const [error, setError] = useState("");
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/deposito/${orderId}`);
    if (r.ok) {
      const p: Prep = await r.json();
      setPrep(p);
      if (p.armador) setArmador(p.armador);
    }
  }, [orderId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function accion(body: any) {
    setError("");
    const r = await fetch(`/api/deposito/${orderId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? "Error"); return null; }
    if (d.items) setPrep(d);
    return d;
  }

  async function iniciar() {
    if (!armador.trim()) { setError("Poné tu nombre para arrancar el armado."); return; }
    await accion({ accion: "iniciar", armador: armador.trim() });
  }
  async function setItem(it: Item, controlado: number, faltante: number) {
    // Optimista
    setPrep(p => p ? { ...p, items: p.items.map(x => x.order_item_id === it.order_item_id ? { ...x, controlado, faltante } : x) } : p);
    await accion({ accion: "item", orderItemId: it.order_item_id, controlado, faltante });
  }
  async function cerrar() {
    setCerrando(true);
    const d = await accion({ accion: "cerrar" });
    setCerrando(false);
    if (d) cargar();
  }

  if (!prep) return <p className="text-sm text-gray-400">Cargando pedido...</p>;

  const enArmado = prep.estado === "armando";
  const cerrado = prep.estado === "listo" || prep.estado === "con_faltante" || prep.estado === "despachado";
  const dir = prep.direccion ?? {};

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <PackageCheck className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Armar pedido</h1>
          <p className="text-sm text-gray-500">{prep.cliente} · #{prep.order_id.slice(0, 8)}</p>
        </div>
        <Link href="/admin/deposito" className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={15} /> Depósito</Link>
      </div>

      {/* Datos de envío */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-800">{dir.fullName}</p>
        {dir.street && <p>{dir.street}</p>}
        <p>{[dir.city, dir.province, dir.postalCode].filter(Boolean).join(", ")}</p>
        {dir.phone && <p>📱 {dir.phone}</p>}
        {prep.notas && <p className="text-xs text-gray-400 mt-1">📝 {prep.notas}</p>}
      </div>

      {/* Estado inicial: arrancar armado */}
      {prep.estado === "para_armar" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row items-center gap-3">
          <input value={armador} onChange={e => setArmador(e.target.value)} placeholder="Tu nombre (quién arma)"
            className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none" />
          <button onClick={iniciar} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-5 py-2 rounded-xl w-full sm:w-auto">
            Empezar a armar
          </button>
        </div>
      )}

      {/* Lista de ítems */}
      {(enArmado || cerrado) && (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y">
          {prep.items.map(it => {
            const resuelto = it.controlado + it.faltante >= it.pedido;
            return (
              <div key={it.order_item_id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {resuelto ? (it.faltante > 0 ? "⚠️ " : "✅ ") : "⭕ "}{it.producto}
                    </p>
                    {it.variante && <p className="text-xs text-gray-400">{it.variante}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">Pedido: <b>{it.pedido}</b></p>
                  </div>
                  {!cerrado && (
                    <button onClick={() => setItem(it, it.pedido, 0)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 ${it.controlado >= it.pedido && it.faltante === 0 ? "bg-emerald-600 text-white" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
                      <Check size={13} className="inline" /> Todo OK
                    </button>
                  )}
                </div>
                {!cerrado && (
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <label className="flex items-center gap-1.5 text-gray-500">
                      Controlé
                      <input type="number" min={0} max={it.pedido} value={it.controlado}
                        onChange={e => { const c = Math.min(it.pedido, Math.max(0, Number(e.target.value) || 0)); setItem(it, c, Math.min(it.faltante, it.pedido - c)); }}
                        className="w-16 border rounded-lg px-2 py-1 text-center" />
                    </label>
                    <label className="flex items-center gap-1.5 text-red-500">
                      Faltan
                      <input type="number" min={0} max={it.pedido} value={it.faltante}
                        onChange={e => { const f = Math.min(it.pedido, Math.max(0, Number(e.target.value) || 0)); setItem(it, Math.min(it.controlado, it.pedido - f), f); }}
                        className="w-16 border rounded-lg px-2 py-1 text-center" />
                    </label>
                  </div>
                )}
                {cerrado && (
                  <p className="text-xs text-gray-500 mt-1">Controlado: {it.controlado}{it.faltante > 0 && <span className="text-red-500"> · Faltan {it.faltante}</span>}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2"><AlertTriangle size={15} /> {error}</div>}

      {/* Cierre */}
      {enArmado && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          {!prep.completo && (
            <p className="text-xs text-amber-600 mb-2">Tildá o marcá faltante en <b>todos</b> los ítems para poder cerrar e imprimir la etiqueta.</p>
          )}
          <button onClick={cerrar} disabled={!prep.completo || cerrando}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-xl">
            {cerrando ? "Cerrando..." : prep.hayFaltante ? "Cerrar con faltantes e imprimir" : "Cerrar armado e imprimir etiqueta"}
          </button>
        </div>
      )}

      {/* Cerrado → imprimir + despachar */}
      {cerrado && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className={`text-sm font-medium ${prep.hayFaltante ? "text-red-600" : "text-emerald-600"}`}>
            {prep.hayFaltante ? "⚠️ Cerrado con faltantes" : "✅ Pedido completo y controlado"}
            {prep.estado === "despachado" && " · Despachado"}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <a href={`/admin/deposito/${orderId}/etiqueta`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl">
              <Printer size={16} /> Imprimir etiqueta + remito
            </a>
            {prep.estado !== "despachado" && (
              <button onClick={() => accion({ accion: "despachar" })}
                className="flex items-center justify-center gap-2 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-sm font-medium px-4 py-2.5 rounded-xl">
                <Truck size={16} /> Marcar despachado
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
