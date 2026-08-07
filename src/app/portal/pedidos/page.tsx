"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Repeat } from "lucide-react";
import { PortalHeader } from "../PortalHeader";

interface Item { quantity: number; unitPrice: string; product?: { name?: string }; variant?: { name?: string } }
interface Pedido { id: string; status: string; total: string; createdAt: string; notes?: string | null; items: Item[] }

const ESTADO: Record<string, string> = {
  PENDING: "Recibido", PROCESSING: "En preparación", SHIPPED: "Despachado",
  DELIVERED: "Entregado", CANCELLED: "Cancelado", REFUNDED: "Reembolsado",
};

const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [repitiendo, setRepitiendo] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function cargar() {
    setCargando(true);
    const r = await fetch("/api/portal/pedidos");
    const d = await r.json().catch(() => ({}));
    setPedidos(d.pedidos ?? []);
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  async function repetir(id: string) {
    if (!confirm("¿Repetir este pedido? Vamos a crear uno nuevo con los mismos productos.")) return;
    setRepitiendo(id); setMsg("");
    const r = await fetch("/api/portal/pedidos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id }),
    });
    const d = await r.json().catch(() => ({}));
    setRepitiendo(null);
    if (r.ok) { setMsg("✅ ¡Pedido enviado! Te vamos a contactar para coordinar el pago y el envío."); cargar(); }
    else setMsg(`Error: ${d.error ?? "no se pudo repetir"}`);
  }

  return (
    <>
    <PortalHeader />
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/portal" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-bold text-gray-900">Mis pedidos</h1>
        <button onClick={cargar} className="ml-auto text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {msg && <p className="text-sm bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl px-3 py-2">{msg}</p>}

      {cargando ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-gray-500 text-sm">Todavía no tenés pedidos.</p>
          <Link href="/productos" className="inline-block mt-3 text-emerald-600 font-medium hover:underline">Ver catálogo →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-gray-400">#{p.id.slice(0, 8)}</span>
                <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{ESTADO[p.status] ?? p.status}</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(p.createdAt).toLocaleDateString("es-AR")}</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-0.5 mb-3">
                {p.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{it.quantity}× {it.product?.name ?? "Producto"}{it.variant?.name ? ` (${it.variant.name})` : ""}</span>
                    <span className="text-gray-500 shrink-0">{money(Number(it.unitPrice) * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm font-semibold text-gray-900">Total: {money(Number(p.total))}</span>
                <button onClick={() => repetir(p.id)} disabled={repitiendo !== null}
                  className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-xl">
                  <Repeat size={14} /> {repitiendo === p.id ? "Enviando..." : "Repetir pedido"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
    </>
  );
}
