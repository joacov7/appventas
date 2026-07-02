"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Link2, Check, X, ExternalLink, AlertTriangle, Target, Zap } from "lucide-react";

type Posicion = {
  product_id: string;
  producto: string;
  slug: string;
  mi_precio: number | null;
  costo: number | null;
  competidores: number;
  mercado_min: number | null;
  mercado_prom: number | null;
  mercado_max: number | null;
  posicion_pct: number | null;
  margen_pct: number | null;
  margen_si_igualo_min: number | null;
  bajadas_recientes: number;
  sugerencia: { precio: number; motivo: string; margen_resultante: number | null } | null;
};

type ProductoPropio = { id: string; name: string };

type Candidato = {
  competidor_id: number;
  nombre: string;
  precio: number;
  imagen: string | null;
  url: string;
  tienda_nombre: string;
  score: number;
};

type Link = Candidato & { id: number; estado: string; disponible: boolean };

function fmt(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

export function PosicionTab() {
  const [posiciones, setPosiciones] = useState<Posicion[]>([]);
  const [productos, setProductos] = useState<ProductoPropio[]>([]);
  const [loading, setLoading] = useState(true);

  // Panel de vinculación
  const [vinculando, setVinculando] = useState<string | null>(null); // product_id
  const [links, setLinks] = useState<Link[]>([]);
  const [sugerencias, setSugerencias] = useState<Candidato[]>([]);
  const [cargandoSug, setCargandoSug] = useState(false);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [aplicarMsg, setAplicarMsg] = useState("");

  async function fetchPosiciones() {
    setLoading(true);
    const r = await fetch("/api/inteligencia/posicion");
    if (r.ok) setPosiciones(await r.json());
    setLoading(false);
  }

  async function fetchProductosPropios() {
    const r = await fetch("/api/productos");
    if (!r.ok) return;
    const data = await r.json();
    const list: any[] = Array.isArray(data) ? data : (data.products ?? data.productos ?? []);
    setProductos(list.map((p: any) => ({ id: p.id, name: p.name ?? p.nombre })));
  }

  useEffect(() => { fetchPosiciones(); fetchProductosPropios(); }, []);

  async function abrirVinculacion(productId: string) {
    setVinculando(productId);
    setCargandoSug(true);
    setLinks([]); setSugerencias([]);
    const r = await fetch(`/api/inteligencia/links?productId=${productId}`);
    if (r.ok) {
      const data = await r.json();
      setLinks(data.links ?? []);
      setSugerencias(data.sugerencias ?? []);
    }
    setCargandoSug(false);
  }

  async function setEstado(productId: string, competidorId: number, estado: "confirmado" | "descartado") {
    await fetch("/api/inteligencia/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, competidorId, estado }),
    });
    await abrirVinculacion(productId);
    fetchPosiciones();
  }

  async function aplicarPrecio(p: Posicion) {
    if (!p.sugerencia) return;
    const margen = p.sugerencia.margen_resultante != null ? ` (margen resultante: ${p.sugerencia.margen_resultante.toFixed(0)}%)` : "";
    if (!confirm(`¿Cambiar el precio de "${p.producto}" de ${fmt(p.mi_precio)} a ${fmt(p.sugerencia.precio)}?${margen}\n\n${p.sugerencia.motivo}.`)) return;
    setAplicando(p.product_id); setAplicarMsg("");
    try {
      const r = await fetch("/api/inteligencia/aplicar-precio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.product_id, precio: p.sugerencia.precio }),
      });
      const data = await r.json();
      if (!r.ok) { setAplicarMsg(data.error ?? "Error al aplicar"); return; }
      setAplicarMsg(`✓ "${p.producto}": ${fmt(data.precio_anterior)} → ${fmt(data.precio_nuevo)} (variante ${data.variante})`);
      fetchPosiciones();
    } catch {
      setAplicarMsg("Error de conexión");
    } finally { setAplicando(null); }
  }

  async function quitarLink(linkId: number, productId: string) {
    await fetch(`/api/inteligencia/links?id=${linkId}`, { method: "DELETE" });
    await abrirVinculacion(productId);
    fetchPosiciones();
  }

  const vinculados = new Set(posiciones.map(p => p.product_id));
  const sinVincular = productos.filter(p => !vinculados.has(p.id));

  function posicionBadge(pct: number | null) {
    if (pct == null) return <span className="text-gray-400 text-xs">—</span>;
    const abs = Math.abs(pct).toFixed(0);
    if (pct > 10) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">🔴 +{abs}% vs prom</span>;
    if (pct > 3)  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">🟡 +{abs}% vs prom</span>;
    if (pct < -3) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">🟢 −{abs}% vs prom</span>;
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">≈ mercado</span>;
  }

  return (
    <div>
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-5 text-sm text-indigo-800">
        <p className="font-medium mb-1 flex items-center gap-2"><Target size={16} /> Tu posición frente al mercado</p>
        <p className="text-indigo-700">Vinculá cada producto tuyo con los equivalentes de la competencia (una sola vez). Después, cada scrape actualiza precios y acá ves si estás caro, barato o alineado — con tu margen real calculado.</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 text-sm">Productos vinculados ({posiciones.length})</h3>
        <button onClick={fetchPosiciones} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {aplicarMsg && (
        <p className={`text-sm mb-3 ${aplicarMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{aplicarMsg}</p>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : posiciones.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border mb-6">
          <Target size={36} strokeWidth={1} className="mx-auto mb-3" />
          <p className="mb-1">Todavía no vinculaste productos.</p>
          <p className="text-xs">Elegí un producto abajo y confirmá sus equivalentes de la competencia.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden mb-6">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-right">Mi precio</th>
                <th className="px-4 py-3 text-right">Mercado (min/prom/max)</th>
                <th className="px-4 py-3 text-center">Posición</th>
                <th className="px-4 py-3 text-right">Margen</th>
                <th className="px-4 py-3 text-center">Alerta</th>
                <th className="px-4 py-3 text-center">Sugerido</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posiciones.map((p) => (
                <tr key={p.product_id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.producto}</p>
                    <p className="text-xs text-gray-400">{p.competidores} competidor{p.competidores !== 1 ? "es" : ""} vinculado{p.competidores !== 1 ? "s" : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(p.mi_precio)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {fmt(p.mercado_min)} / <span className="font-medium">{fmt(p.mercado_prom)}</span> / {fmt(p.mercado_max)}
                  </td>
                  <td className="px-4 py-3 text-center">{posicionBadge(p.posicion_pct)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.margen_pct != null ? (
                      <span className={p.margen_pct < 15 ? "text-red-600 font-medium" : "text-gray-700"}>{p.margen_pct.toFixed(0)}%</span>
                    ) : <span className="text-gray-300 text-xs" title="Cargá el costo en el producto">sin costo</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.bajadas_recientes > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600" title={
                        p.margen_si_igualo_min != null
                          ? `Si igualás el mínimo (${fmt(p.mercado_min)}) tu margen queda en ${p.margen_si_igualo_min.toFixed(0)}%`
                          : "Un competidor bajó el precio"
                      }>
                        <AlertTriangle size={13} /> {p.bajadas_recientes} bajada{p.bajadas_recientes > 1 ? "s" : ""}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.sugerencia ? (
                      <button
                        onClick={() => aplicarPrecio(p)}
                        disabled={aplicando === p.product_id}
                        title={`${p.sugerencia.motivo}${p.sugerencia.margen_resultante != null ? ` · margen resultante ${p.sugerencia.margen_resultante.toFixed(0)}%` : ""}`}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                      >
                        <Zap size={12} />
                        {aplicando === p.product_id ? "..." : fmt(p.sugerencia.precio)}
                      </button>
                    ) : <span className="text-gray-300 text-xs">ok</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => abrirVinculacion(p.product_id)}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1 ml-auto">
                      <Link2 size={12} /> Vínculos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Vincular producto nuevo */}
      {sinVincular.length > 0 && (
        <div className="bg-white rounded-2xl border p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Vincular otro producto</p>
          <div className="flex gap-2 flex-wrap">
            {sinVincular.slice(0, 30).map((p) => (
              <button key={p.id} onClick={() => abrirVinculacion(p.id)}
                className="px-3 py-1.5 rounded-full text-xs bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors">
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Panel de vinculación */}
      {vinculando && (
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Link2 size={16} className="text-indigo-600" />
              {productos.find(p => p.id === vinculando)?.name ?? "Producto"}
            </h3>
            <button onClick={() => setVinculando(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
          </div>

          {cargandoSug ? (
            <p className="text-gray-400 text-sm">Buscando equivalentes...</p>
          ) : (
            <>
              {links.filter(l => l.estado === "confirmado").length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Vinculados</p>
                  <div className="space-y-2">
                    {links.filter(l => l.estado === "confirmado").map((l) => (
                      <div key={l.id} className="flex items-center gap-3 bg-emerald-50 rounded-xl p-2.5">
                        {l.imagen && <img src={l.imagen} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{l.nombre}</p>
                          <p className="text-xs text-gray-500">{l.tienda_nombre} · {fmt(l.precio)}{!l.disponible && " · sin stock"}</p>
                        </div>
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-gray-600"><ExternalLink size={14} /></a>
                        <button onClick={() => quitarLink(l.id, vinculando)} className="p-1.5 text-gray-400 hover:text-red-600"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Sugerencias</p>
              {sugerencias.length === 0 ? (
                <p className="text-sm text-gray-400">No se encontraron productos parecidos en la competencia. Scrapeá más tiendas o buscá en MercadoLibre desde la pestaña Búsquedas.</p>
              ) : (
                <div className="space-y-2">
                  {sugerencias.map((s) => (
                    <div key={s.competidor_id} className="flex items-center gap-3 border rounded-xl p-2.5 hover:bg-gray-50">
                      {s.imagen && <img src={s.imagen} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{s.nombre}</p>
                        <p className="text-xs text-gray-500">{s.tienda_nombre} · {fmt(s.precio)}</p>
                      </div>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-gray-600"><ExternalLink size={14} /></a>
                      <button onClick={() => setEstado(vinculando, s.competidor_id, "confirmado")}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                        <Check size={12} /> Es este
                      </button>
                      <button onClick={() => setEstado(vinculando, s.competidor_id, "descartado")}
                        className="flex items-center gap-1 text-gray-400 hover:text-red-600 text-xs px-2 py-1.5">
                        <X size={12} /> No
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
