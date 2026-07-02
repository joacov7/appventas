"use client";

import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp, Store, Search, Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink, RefreshCw, Bell, Package } from "lucide-react";
import { PosicionTab } from "./PosicionTab";

type Busqueda = { id: number; termino: string; plataforma: string; activa: boolean; umbral_alerta: number };
type Tienda = { id: number; nombre: string; url: string; plataforma: string; activa: boolean; ultimo_scrape: string; total_productos: number; bajadas: number };
type Producto = {
  id: number; nombre: string; precio: number | null; precio_anterior: number | null;
  categoria: string | null; url: string; imagen: string | null;
  ultima_vez: string; tienda_nombre: string; tienda_url: string; plataforma: string;
};

const TABS = ["Búsquedas", "Tiendas", "Productos", "Mi posición"] as const;
type Tab = typeof TABS[number];

const PLATAFORMAS = ["todas", "tiendanube", "empretienda", "mercadolibre"];

function pctCambio(prod: Producto) {
  if (!prod.precio || !prod.precio_anterior) return null;
  return ((prod.precio - prod.precio_anterior) / prod.precio_anterior * 100);
}

function formatPrecio(n: number | null) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

export default function InteligenciaPage() {
  const [tab, setTab] = useState<Tab>("Búsquedas");
  const [busquedas, setBusquedas] = useState<Busqueda[]>([]);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState<number | null>(null);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);

  // Form nueva búsqueda
  const [termino, setTermino] = useState("");
  const [plataforma, setPlataforma] = useState("todas");
  const [umbral, setUmbral] = useState(10);

  // ML scrape by term
  const [mlTermino, setMlTermino] = useState("");
  const [mlScraping, setMlScraping] = useState(false);
  const [mlMsg, setMlMsg] = useState<string | null>(null);

  // Filtros productos
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroTienda, setFiltroTienda] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);

  async function fetchBusquedas() {
    const r = await fetch("/api/inteligencia/busquedas");
    setBusquedas(await r.json());
  }
  async function fetchTiendas() {
    const r = await fetch("/api/inteligencia/tiendas");
    setTiendas(await r.json());
  }
  async function fetchProductos() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroTienda) params.set("tienda", filtroTienda);
    if (soloAlertas) params.set("alertas", "1");
    if (filtroBusqueda) params.set("q", filtroBusqueda);
    const r = await fetch(`/api/inteligencia/productos?${params}`);
    setProductos(await r.json());
    setLoading(false);
  }

  useEffect(() => { fetchBusquedas(); }, []);
  useEffect(() => { if (tab === "Tiendas") fetchTiendas(); }, [tab]);
  useEffect(() => { if (tab === "Productos") fetchProductos(); }, [tab, filtroTienda, soloAlertas]);

  async function agregarBusqueda() {
    if (!termino.trim()) return;
    await fetch("/api/inteligencia/busquedas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termino, plataforma, umbral_alerta: umbral }),
    });
    setTermino("");
    fetchBusquedas();
  }

  async function toggleBusqueda(b: Busqueda) {
    await fetch(`/api/inteligencia/busquedas/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !b.activa }),
    });
    fetchBusquedas();
  }

  async function scrapearTienda(id: number) {
    setScraping(id);
    setScrapeMsg(null);
    try {
      const r = await fetch("/api/inteligencia/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiendaId: id }),
      });
      const data = await r.json();
      setScrapeMsg(r.ok ? `✓ ${data.total} productos actualizados` : `✗ ${data.error}`);
      fetchTiendas();
    } catch {
      setScrapeMsg("✗ Error de red");
    } finally {
      setScraping(null);
    }
  }

  async function scrapeML() {
    if (!mlTermino.trim()) return;
    setMlScraping(true);
    setMlMsg(null);
    try {
      const r = await fetch("/api/inteligencia/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termino: mlTermino }),
      });
      const data = await r.json();
      setMlMsg(r.ok ? `✓ ${data.total} productos de MercadoLibre` : `✗ ${data.error}`);
      fetchTiendas();
    } catch {
      setMlMsg("✗ Error de red");
    } finally {
      setMlScraping(false);
    }
  }

  async function eliminarBusqueda(id: number) {
    if (!confirm("¿Eliminar esta búsqueda?")) return;
    await fetch(`/api/inteligencia/busquedas/${id}`, { method: "DELETE" });
    fetchBusquedas();
  }

  const alertasCount = productos.filter(p => { const pct = pctCambio(p); return pct !== null && pct < 0; }).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingDown className="text-emerald-600" size={22} />
          <h1 className="text-xl font-bold text-gray-900">Inteligencia de Precios</h1>
        </div>
        {tab === "Productos" && alertasCount > 0 && (
          <span className="flex items-center gap-1.5 bg-red-50 text-red-600 text-sm font-medium px-3 py-1.5 rounded-full">
            <Bell size={14} /> {alertasCount} {alertasCount === 1 ? "bajada" : "bajadas"} de precio
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab: Búsquedas ── */}
      {tab === "Búsquedas" && (
        <div className="space-y-4">
          {/* MercadoLibre scrape */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-1 flex items-center gap-1.5">
              <Search size={14} /> Buscar precios en MercadoLibre
            </p>
            <p className="text-xs text-yellow-600 mb-3">Ingresá un término y traemos hasta 200 resultados de la API pública de ML.</p>
            <div className="flex gap-2 flex-wrap">
              <input
                value={mlTermino}
                onChange={e => setMlTermino(e.target.value)}
                onKeyDown={e => e.key === "Enter" && scrapeML()}
                placeholder="ej: mate calabaza artesanal"
                className="flex-1 min-w-48 border border-yellow-300 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <button
                onClick={scrapeML}
                disabled={mlScraping || !mlTermino.trim()}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium"
              >
                {mlScraping ? <><RefreshCw size={13} className="animate-spin" /> Buscando...</> : "Buscar en ML"}
              </button>
            </div>
            {mlMsg && (
              <p className={`text-xs mt-2 font-medium ${mlMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{mlMsg}</p>
            )}
          </div>

          {/* Form agregar búsqueda */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-700 mb-3">Nueva búsqueda</p>
            <div className="flex gap-2 flex-wrap">
              <input
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && agregarBusqueda()}
                placeholder="ej: mates madera mayorista"
                className="flex-1 min-w-0 w-full sm:min-w-48 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={plataforma}
                onChange={(e) => setPlataforma(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none"
              >
                {PLATAFORMAS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Alerta si baja</span>
                <input
                  type="number" min={1} max={100} value={umbral}
                  onChange={(e) => setUmbral(Number(e.target.value))}
                  className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-sm text-gray-900 text-center"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <button
                onClick={agregarBusqueda}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Plus size={15} /> Agregar
              </button>
            </div>
          </div>

          {/* Lista */}
          {busquedas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">No hay búsquedas configuradas.</p>
          ) : busquedas.map((b) => (
            <div key={b.id} className={`bg-white rounded-2xl border p-4 shadow-sm flex items-center gap-3 ${!b.activa ? "opacity-50" : "border-gray-100"}`}>
              <Search size={16} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{b.termino}</p>
                <p className="text-xs text-gray-400">{b.plataforma} · alerta si baja {b.umbral_alerta}%</p>
              </div>
              <button onClick={() => toggleBusqueda(b)} className="text-gray-400 hover:text-emerald-600 transition-colors">
                {b.activa ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
              </button>
              <button onClick={() => eliminarBusqueda(b.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Tiendas ── */}
      {tab === "Tiendas" && (
        <div>
          {/* Form agregar tienda manual */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Agregar tienda competidora</p>
            <div className="flex gap-2 flex-wrap">
              <input
                id="tienda-url"
                placeholder="URL de la tienda (ej: https://mitienda.mitiendanube.com)"
                className="flex-1 min-w-64 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                id="tienda-nombre"
                placeholder="Nombre (opcional)"
                className="w-44 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none"
              />
              <button
                onClick={async () => {
                  const url = (document.getElementById("tienda-url") as HTMLInputElement).value;
                  const nombre = (document.getElementById("tienda-nombre") as HTMLInputElement).value;
                  if (!url.trim()) return;
                  await fetch("/api/inteligencia/tiendas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url, nombre }),
                  });
                  (document.getElementById("tienda-url") as HTMLInputElement).value = "";
                  (document.getElementById("tienda-nombre") as HTMLInputElement).value = "";
                  fetchTiendas();
                }}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Plus size={15} /> Agregar
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">El scraper va a visitar estas tiendas automáticamente en cada corrida y detectar cambios de precio.</p>
          {scrapeMsg && (
            <p className={`text-xs mt-2 font-medium ${scrapeMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{scrapeMsg}</p>
          )}
          </div>

          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{tiendas.length} tiendas configuradas</p>
            <button onClick={fetchTiendas} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>
          {tiendas.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Store size={40} className="mx-auto mb-3 opacity-30" />
              <p>Agregá tiendas de competidores arriba.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tiendas.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.nombre}</p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.plataforma}</span>
                    </div>
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-emerald-600">
                      <ExternalLink size={15} />
                    </a>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><Package size={11} /> {t.total_productos} productos</span>
                    {t.bajadas > 0 && (
                      <span className="flex items-center gap-1 text-red-500 font-medium">
                        <TrendingDown size={11} /> {t.bajadas} bajadas
                      </span>
                    )}
                    {t.ultimo_scrape && (
                      <span>Scrapeado {new Date(t.ultimo_scrape).toLocaleDateString("es-AR")}</span>
                    )}
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded-full">{t.plataforma}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      onClick={() => { setFiltroTienda(String(t.id)); setTab("Productos"); }}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      Ver productos →
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => scrapearTienda(t.id)}
                        disabled={scraping === t.id}
                        className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-lg"
                      >
                        <RefreshCw size={11} className={scraping === t.id ? "animate-spin" : ""} />
                        {scraping === t.id ? "Scrapeando..." : "Scrapear"}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar ${t.nombre}?`)) return;
                          await fetch(`/api/inteligencia/tiendas/${t.id}`, { method: "DELETE" });
                          fetchTiendas();
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Productos ── */}
      {tab === "Productos" && (
        <div>
          {/* Filtros */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <input
              value={filtroBusqueda}
              onChange={(e) => setFiltroBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchProductos()}
              placeholder="Buscar producto..."
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={filtroTienda}
              onChange={(e) => setFiltroTienda(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none"
            >
              <option value="">Todas las tiendas</option>
              {tiendas.map((t) => <option key={t.id} value={String(t.id)}>{t.nombre}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} className="rounded" />
              Solo bajadas de precio
            </label>
            <button onClick={fetchProductos} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 ml-auto">
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">Cargando...</p>
          ) : productos.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay productos todavía.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-left">Tienda</th>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-right">Precio actual</th>
                    <th className="px-4 py-3 text-right">Precio anterior</th>
                    <th className="px-4 py-3 text-center">Cambio</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {productos.map((p) => {
                    const pct = pctCambio(p);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {p.imagen && (
                              <img src={p.imagen} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            )}
                            <span className="font-medium text-gray-900 line-clamp-1 max-w-48">{p.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.tienda_nombre}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{p.categoria ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatPrecio(p.precio)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{formatPrecio(p.precio_anterior)}</td>
                        <td className="px-4 py-3 text-center">
                          {pct !== null ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${pct < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                              {pct < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                              {Math.abs(pct).toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-emerald-600">
                              <ExternalLink size={14} />
                            </a>
                            <a href="/admin/productos" className="text-xs text-emerald-600 hover:underline whitespace-nowrap">
                              Ajustar precio
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Mi posición ── */}
      {tab === "Mi posición" && <PosicionTab />}
    </div>
  );
}
