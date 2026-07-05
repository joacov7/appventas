"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Calculator, Search, Plus, Trash2, X } from "lucide-react";

interface ProductoCotizable {
  id: string; nombre: string; precio: number | null; precio_mayorista: number | null;
  costo: number | null; fabricante: string | null; descuento_b2b_pct: number;
}
interface Linea {
  productId: string; nombre: string; cantidad: number;
  precio_base: number; precio_unitario: number; subtotal: number;
  costo: number | null; margen_pct: number | null; bajo_piso: boolean; aviso?: string;
}
interface Presupuesto {
  lineas: Linea[]; canal: string; medioPago: string; recargo_medio_pago_pct: number;
  subtotal: number; descuento_global_pct: number; descuento_global_monto: number;
  total: number; avisos: string[];
}
interface ItemSel { productId: string; nombre: string; cantidad: number }

const MEDIOS: { k: string; label: string }[] = [
  { k: "efectivo", label: "Efectivo" }, { k: "transferencia", label: "Transferencia" },
  { k: "debito", label: "Débito" }, { k: "credito1", label: "Crédito 1 cuota" },
  { k: "credito3", label: "Crédito 3 cuotas" }, { k: "credito6", label: "Crédito 6 cuotas" },
  { k: "mercadoPago", label: "MercadoPago" }, { k: "echeq", label: "E-cheq" },
];

function money(n: number | null) {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export default function CotizadorPage() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ProductoCotizable[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [items, setItems] = useState<ItemSel[]>([]);
  const [canal, setCanal] = useState<"minorista" | "mayorista">("mayorista");
  const [medioPago, setMedioPago] = useState("transferencia");
  const [descuento, setDescuento] = useState(0);
  const [cliente, setCliente] = useState({ nombre: "", empresa: "" });
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const debounce = useRef<any>(null);

  // Buscar productos
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setBuscando(true);
      const r = await fetch(`/api/cotizador/productos?q=${encodeURIComponent(q)}`);
      if (r.ok) setResultados(await r.json());
      setBuscando(false);
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q]);

  // Recalcular cuando cambia algo
  const recalcular = useCallback(async () => {
    if (items.length === 0) { setPresupuesto(null); return; }
    const r = await fetch("/api/cotizador/calcular", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, canal, medioPago, descuentoGlobalPct: descuento }),
    });
    if (r.ok) setPresupuesto(await r.json());
  }, [items, canal, medioPago, descuento]);

  useEffect(() => { recalcular(); }, [recalcular]);

  function agregar(p: ProductoCotizable) {
    setItems(prev => prev.some(i => i.productId === p.id)
      ? prev
      : [...prev, { productId: p.id, nombre: p.nombre, cantidad: 1 }]);
    setQ("");
  }
  function cambiarCantidad(id: string, cantidad: number) {
    setItems(prev => prev.map(i => i.productId === id ? { ...i, cantidad: Math.max(1, cantidad) } : i));
  }
  function quitar(id: string) { setItems(prev => prev.filter(i => i.productId !== id)); }

  const lineaDe = (id: string) => presupuesto?.lineas.find(l => l.productId === id);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cotizador</h1>
          <p className="text-sm text-gray-500">Presupuestos automáticos: precio, descuento B2B y medio de pago calculados solos.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Columna izquierda: armado */}
        <div className="lg:col-span-3 space-y-4">
          {/* Buscador */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto para agregar..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border rounded-xl outline-none" />
            </div>
            {q && (
              <div className="mt-2 max-h-56 overflow-y-auto divide-y">
                {buscando ? <p className="text-xs text-gray-400 p-2">Buscando...</p>
                  : resultados.length === 0 ? <p className="text-xs text-gray-400 p-2">Sin resultados</p>
                  : resultados.map(p => (
                    <button key={p.id} onClick={() => agregar(p)}
                      className="w-full flex items-center justify-between gap-2 p-2 hover:bg-gray-50 text-left">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{p.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {money(p.precio)} min · {p.fabricante ?? "sin fabricante"}
                        </p>
                      </div>
                      <Plus size={16} className="text-indigo-600 shrink-0" />
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Líneas seleccionadas */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Agregá productos desde el buscador.</p>
            ) : (
              <div className="space-y-2">
                {items.map(i => {
                  const l = lineaDe(i.productId);
                  return (
                    <div key={i.productId} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{i.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {l ? <>{money(l.precio_unitario)} c/u{l.margen_pct != null && <> · margen {l.margen_pct}%</>}</> : "…"}
                          {l?.bajo_piso && <span className="text-amber-600"> · {l.aviso}</span>}
                        </p>
                      </div>
                      <input type="number" min={1} value={i.cantidad}
                        onChange={e => cambiarCantidad(i.productId, Number(e.target.value))}
                        className="w-16 text-sm border rounded-lg px-2 py-1 text-center" />
                      <span className="w-24 text-right text-sm font-medium text-gray-900">{l ? money(l.subtotal) : "—"}</span>
                      <button onClick={() => quitar(i.productId)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: opciones y total */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500">Cliente</label>
              <input value={cliente.nombre} onChange={e => setCliente(c => ({ ...c, nombre: e.target.value }))}
                placeholder="Nombre" className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
              <input value={cliente.empresa} onChange={e => setCliente(c => ({ ...c, empresa: e.target.value }))}
                placeholder="Empresa (opcional)" className="w-full mt-2 text-sm border rounded-lg px-3 py-2 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Canal</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(["minorista", "mayorista"] as const).map(c => (
                  <button key={c} onClick={() => setCanal(c)}
                    className={`text-sm py-2 rounded-lg border ${canal === c ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600"}`}>
                    {c === "minorista" ? "Minorista (B2C)" : "Mayorista (B2B)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Medio de pago</label>
              <select value={medioPago} onChange={e => setMedioPago(e.target.value)}
                className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none bg-white">
                {MEDIOS.map(m => <option key={m.k} value={m.k}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Descuento comercial %</label>
              <input type="number" min={0} max={100} value={descuento}
                onChange={e => setDescuento(Number(e.target.value))}
                className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
            </div>
          </div>

          {/* Total */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            {presupuesto ? (
              <div className="space-y-1.5 text-sm">
                <Row label="Subtotal" val={money(presupuesto.subtotal)} />
                {presupuesto.recargo_medio_pago_pct > 0 && (
                  <p className="text-xs text-gray-400">Incluye recargo {presupuesto.recargo_medio_pago_pct}% por medio de pago</p>
                )}
                {presupuesto.descuento_global_pct > 0 && (
                  <Row label={`Descuento ${presupuesto.descuento_global_pct}%`} val={`- ${money(presupuesto.descuento_global_monto)}`} />
                )}
                <div className="border-t pt-2 mt-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-indigo-600">{money(presupuesto.total)}</span>
                </div>
                {presupuesto.avisos.length > 0 && (
                  <div className="mt-2 text-xs text-amber-600 space-y-0.5">
                    {presupuesto.avisos.map((a, i) => <p key={i}>⚠ {a}</p>)}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Agregá productos para ver el total.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex items-center justify-between text-gray-600">
      <span>{label}</span><span className="font-medium text-gray-900">{val}</span>
    </div>
  );
}
