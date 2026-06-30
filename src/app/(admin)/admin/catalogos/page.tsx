"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  BookOpen, Settings, Package, Eye, Download, Printer,
  Plus, Trash2, GripVertical, Check, X, Search, ChevronUp, ChevronDown,
  Globe, FileText, Palette,
} from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number; nombre: string; slug: string; descripcion: string | null;
  precio: number | null; sku: string | null; imagen: string | null;
  categoria: string | null; stock: number | null;
}
interface CatalogConfig {
  // Empresa
  logo: string | null;
  logoAncho: number;
  logoAlineacion: "left" | "center" | "right";
  empresa: string;
  slogan: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  sitioWeb: string;
  email: string;
  direccion: string;
  quienesSomos: string;
  // Opciones
  mostrarPrecios: boolean;
  mostrarCodigo: boolean;
  mostrarStock: boolean;
  mostrarQrWhatsapp: boolean;
  mostrarQrWeb: boolean;
  // Precios
  tipoPrecio: "minorista" | "mayorista";
  descuentoMayorista: number;
  etiquetaMayorista: string;
  mostrarPrecioTachado: boolean;
  mostrarBadgeDescuento: boolean;
  preciosCustom: Record<number, number>;
  // Diseño
  colorPrincipal: string;
  colorSecundario: string;
  moneda: "ARS" | "USD";
  formato: "A4" | "carta";
  orientacion: "vertical" | "horizontal";
  // Productos
  productosSeleccionados: number[];
  ordenProductos: number[];
}

const DEFAULT_CONFIG: CatalogConfig = {
  logo: null, logoAncho: 120, logoAlineacion: "center", empresa: "", slogan: "", whatsapp: "", instagram: "",
  facebook: "", sitioWeb: "", email: "", direccion: "", quienesSomos: "",
  mostrarPrecios: true, mostrarCodigo: true, mostrarStock: false,
  mostrarQrWhatsapp: true, mostrarQrWeb: false,
  tipoPrecio: "minorista", descuentoMayorista: 20, etiquetaMayorista: "Precio Mayorista", mostrarPrecioTachado: true, mostrarBadgeDescuento: true,
  preciosCustom: {},
  colorPrincipal: "#1a1a1a", colorSecundario: "#10b981",
  moneda: "ARS", formato: "A4", orientacion: "vertical",
  productosSeleccionados: [], ordenProductos: [],
};

const DEFAULT_CONFIG_USA: CatalogConfig = {
  ...DEFAULT_CONFIG,
  moneda: "USD",
  empresa: "Premium Argentine Mate Collection",
  slogan: "Made in Argentina · Worldwide Shipping · Wholesale Available",
};

// ─── Price formatter ──────────────────────────────────────────────────────────
function fmt(n: number | null, moneda: string) {
  if (!n) return "—";
  return new Intl.NumberFormat(moneda === "USD" ? "en-US" : "es-AR", {
    style: "currency", currency: moneda, minimumFractionDigits: 0,
  }).format(n);
}

// ─── Cover Page ───────────────────────────────────────────────────────────────
function CoverPage({ cfg, tipo }: { cfg: CatalogConfig; tipo: "ar" | "usa" }) {
  return (
    <div
      className="relative w-full flex flex-col justify-center text-white overflow-hidden"
      style={{ height: 480, background: `linear-gradient(135deg, ${cfg.colorPrincipal} 0%, ${cfg.colorSecundario} 100%)` }}
    >
      <div className={`flex flex-col px-10 ${cfg.logoAlineacion === "center" ? "items-center text-center" : cfg.logoAlineacion === "right" ? "items-end text-right" : "items-start text-left"}`}>
        {cfg.logo && (
          <img
            src={cfg.logo} alt="logo"
            crossOrigin="anonymous"
            className="object-contain mb-6 drop-shadow-lg"
            style={{ width: cfg.logoAncho, height: "auto" }}
          />
        )}
        <h1 className="text-4xl font-bold drop-shadow">{cfg.empresa || (tipo === "usa" ? "Premium Mate Collection" : "Catálogo de Productos")}</h1>
        {cfg.slogan && <p className="mt-3 text-lg text-white/80">{cfg.slogan}</p>}
        {cfg.tipoPrecio === "mayorista" && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/20 border border-white/30 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
            📦 Catálogo Mayorista{cfg.mostrarBadgeDescuento ? ` · ${cfg.descuentoMayorista}% OFF` : ""}
          </div>
        )}
        {tipo === "usa" && (
          <div className="mt-6 flex flex-wrap gap-2">
            {["Made in Argentina", "Wholesale", "Private Label", "Laser Engraving", "Worldwide Shipping"].map(t => (
              <span key={t} className="text-xs border border-white/40 text-white px-3 py-1 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="absolute bottom-4 right-6 text-white/50 text-xs">{new Date().toLocaleDateString(tipo === "usa" ? "en-US" : "es-AR")}</div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ p, cfg, tipo }: { p: Product; cfg: CatalogConfig; tipo: "ar" | "usa" }) {
  const esMayorista = cfg.tipoPrecio === "mayorista";
  const precioCustom = cfg.preciosCustom?.[p.id] ?? null;
  const precioMayoristaCalc = p.precio ? p.precio * (1 - cfg.descuentoMayorista / 100) : null;
  const precioMayorista = precioCustom ?? precioMayoristaCalc;
  const precioMostrar = esMayorista ? precioMayorista : p.precio;
  const tieneCustom = precioCustom != null;

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="aspect-square bg-gray-50 overflow-hidden relative">
        {p.imagen ? (
          <img src={p.imagen} alt={p.nombre} crossOrigin="anonymous" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Package size={40} strokeWidth={1} />
          </div>
        )}
        {esMayorista && p.precio && precioMayorista && cfg.mostrarBadgeDescuento && (
          <div className="absolute top-2 left-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cfg.colorSecundario }}>
              {tieneCustom
                ? `-${Math.round((1 - precioMayorista / p.precio) * 100)}%`
                : `${cfg.descuentoMayorista}% OFF`}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        {cfg.mostrarCodigo && p.sku && (
          <p className="text-xs text-gray-400 font-mono mb-1">#{p.sku}</p>
        )}
        <h3 className="font-bold text-gray-900 text-sm mb-1">{p.nombre}</h3>
        {p.categoria && <p className="text-xs text-gray-400 mb-2">{p.categoria}</p>}
        {p.descripcion && <p className="text-xs text-gray-500 line-clamp-3 flex-1 mb-2">{p.descripcion}</p>}
        <div className="mt-auto pt-2 border-t border-gray-100">
          {cfg.mostrarPrecios && precioMostrar ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                {esMayorista && cfg.mostrarPrecioTachado && p.precio && (
                  <p className="text-xs text-gray-400 line-through">{fmt(p.precio, cfg.moneda)}</p>
                )}
                <span className="font-bold text-base" style={{ color: cfg.colorSecundario }}>
                  {fmt(precioMostrar, cfg.moneda)}
                </span>
                {esMayorista && (
                  <p className="text-xs font-medium mt-0.5" style={{ color: cfg.colorSecundario }}>
                    {cfg.etiquetaMayorista}
                  </p>
                )}
              </div>
              {cfg.mostrarStock && (
                <span className="text-xs text-gray-400">Stock: {p.stock ?? "—"}</span>
              )}
            </div>
          ) : (
            cfg.mostrarStock ? <span className="text-xs text-gray-400">Stock: {p.stock ?? "—"}</span> : <span />
          )}
        </div>
        {tipo === "usa" && (
          <div className="mt-2 flex gap-1 flex-wrap">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">MOQ available</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Preview ──────────────────────────────────────────────────────────────────
function CatalogPreview({ cfg, products, tipo }: { cfg: CatalogConfig; products: Product[]; tipo: "ar" | "usa" }) {
  const selected = cfg.ordenProductos.length
    ? cfg.ordenProductos.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[]
    : products.filter(p => cfg.productosSeleccionados.includes(p.id));

  return (
    <div id="catalog-preview" className="bg-white rounded-2xl overflow-hidden border shadow-lg" style={{ maxWidth: 800, margin: "0 auto" }}>
      <CoverPage cfg={cfg} tipo={tipo} />

      {/* Quiénes somos */}
      {cfg.quienesSomos && (
        <div className="px-10 py-8 border-b">
          <h2 className="text-xl font-bold mb-3" style={{ color: cfg.colorPrincipal }}>
            {tipo === "usa" ? "About Us" : "Quiénes Somos"}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">{cfg.quienesSomos}</p>
        </div>
      )}

      {/* Products grid */}
      <div className="p-8">
        <h2 className="text-xl font-bold mb-6" style={{ color: cfg.colorPrincipal }}>
          {tipo === "usa" ? "Our Products" : "Nuestros Productos"}
        </h2>
        {selected.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">Seleccioná productos para incluir en el catálogo</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {selected.map((p) => <ProductCard key={p.id} p={p} cfg={cfg} tipo={tipo} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t flex items-center justify-between text-xs text-gray-400" style={{ background: cfg.colorPrincipal + "08" }}>
        <span>{cfg.empresa}</span>
        <div className="flex gap-4">
          {cfg.whatsapp && <span>📱 {cfg.whatsapp}</span>}
          {cfg.email && <span>✉ {cfg.email}</span>}
          {cfg.sitioWeb && <span>🌐 {cfg.sitioWeb}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────
function ConfigPanel({ cfg, onChange, products }: { cfg: CatalogConfig; onChange: (c: CatalogConfig) => void; products: Product[] }) {
  function set(key: keyof CatalogConfig, val: any) {
    onChange({ ...cfg, [key]: val });
  }
  const input = (label: string, key: keyof CatalogConfig, placeholder?: string) => (
    <div key={key}>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input value={(cfg[key] as string) ?? ""} onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
  );
  const toggle = (label: string, key: keyof CatalogConfig) => (
    <label key={key} className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!(cfg[key])} onChange={e => set(key, e.target.checked)} className="rounded" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );

  return (
    <div className="space-y-6">
      {/* Empresa */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Empresa</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Logo</label>
            <MediaUpload urls={cfg.logo ? [cfg.logo] : []} onChange={urls => set("logo", urls[0] ?? null)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ancho del logo: {cfg.logoAncho}px</label>
            <input type="range" min={40} max={400} value={cfg.logoAncho} onChange={e => set("logoAncho", Number(e.target.value))}
              className="w-full accent-emerald-600" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Alineación del logo</label>
            <div className="flex gap-2">
              {(["left", "center", "right"] as const).map(a => (
                <button key={a} onClick={() => set("logoAlineacion", a)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${cfg.logoAlineacion === a ? "bg-emerald-600 text-white border-emerald-600" : "text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                  {a === "left" ? "← Izq" : a === "center" ? "Centro" : "Der →"}
                </button>
              ))}
            </div>
          </div>
          {input("Nombre de empresa", "empresa", "Mi Empresa")}
          {input("Slogan", "slogan", "Tu slogan aquí")}
          {input("WhatsApp", "whatsapp", "+54 9 11 1234-5678")}
          {input("Instagram", "instagram", "@usuario")}
          {input("Facebook", "facebook", "facebook.com/empresa")}
          {input("Sitio web", "sitioWeb", "www.miempresa.com")}
          {input("Email", "email", "info@miempresa.com")}
          {input("Dirección", "direccion")}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Quiénes Somos</label>
            <textarea value={cfg.quienesSomos} onChange={e => set("quienesSomos", e.target.value)}
              rows={4} placeholder="Descripción de la empresa..."
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
        </div>
      </div>

      {/* Precios */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tipo de precios</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["minorista", "mayorista"] as const).map(t => (
              <button key={t} onClick={() => set("tipoPrecio", t)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${cfg.tipoPrecio === t ? "bg-emerald-600 text-white border-emerald-600" : "text-gray-600 border-gray-200 hover:border-emerald-400"}`}>
                {t === "minorista" ? "🛒 Minorista" : "📦 Mayorista"}
              </button>
            ))}
          </div>
          {cfg.tipoPrecio === "mayorista" && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Descuento global: <span className="text-emerald-600 font-bold">{cfg.descuentoMayorista}%</span></label>
                <input type="range" min={1} max={70} value={cfg.descuentoMayorista}
                  onChange={e => set("descuentoMayorista", Number(e.target.value))}
                  className="w-full accent-emerald-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>1%</span><span>70%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Se aplica a los productos sin precio manual.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Etiqueta de precio</label>
                <input value={cfg.etiquetaMayorista} onChange={e => set("etiquetaMayorista", e.target.value)}
                  placeholder="Precio Mayorista"
                  className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={cfg.mostrarPrecioTachado} onChange={e => set("mostrarPrecioTachado", e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700">Mostrar precio minorista tachado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={cfg.mostrarBadgeDescuento ?? true} onChange={e => set("mostrarBadgeDescuento", e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-700">Mostrar badge de descuento (% OFF)</span>
              </label>

              {/* Precios manuales por producto */}
              {cfg.productosSeleccionados.length > 0 && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-700">Precios por producto</label>
                    {Object.keys(cfg.preciosCustom ?? {}).length > 0 && (
                      <button
                        onClick={() => set("preciosCustom", {})}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Limpiar todo
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Dejá vacío para usar el descuento global.</p>
                  <div className="space-y-2">
                    {cfg.productosSeleccionados.map(id => {
                      const p = products.find(x => x.id === id);
                      if (!p) return null;
                      const customVal = cfg.preciosCustom?.[id];
                      const globalCalc = p.precio ? p.precio * (1 - cfg.descuentoMayorista / 100) : null;
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{p.nombre}</p>
                            {globalCalc && !customVal && (
                              <p className="text-xs text-gray-400">Global: {fmt(globalCalc, cfg.moneda)}</p>
                            )}
                          </div>
                          <div className="relative shrink-0">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={customVal ?? ""}
                              onChange={e => {
                                const v = e.target.value === "" ? undefined : Number(e.target.value);
                                const next = { ...(cfg.preciosCustom ?? {}) };
                                if (v == null) delete next[id];
                                else next[id] = v;
                                set("preciosCustom", next);
                              }}
                              placeholder={globalCalc ? String(Math.round(globalCalc)) : "—"}
                              className={`w-28 border rounded-lg pl-5 pr-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${customVal != null ? "border-emerald-300 bg-emerald-50" : ""}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Diseño */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Diseño</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Color principal</label>
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.colorPrincipal} onChange={e => set("colorPrincipal", e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border" />
                <span className="text-xs text-gray-400 font-mono">{cfg.colorPrincipal}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Color secundario</label>
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.colorSecundario} onChange={e => set("colorSecundario", e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border" />
                <span className="text-xs text-gray-400 font-mono">{cfg.colorSecundario}</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Moneda</label>
            <select value={cfg.moneda} onChange={e => set("moneda", e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none">
              <option value="ARS">ARS — Peso argentino</option>
              <option value="USD">USD — Dólar</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Formato</label>
              <select value={cfg.formato} onChange={e => set("formato", e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none">
                <option value="A4">A4</option>
                <option value="carta">Carta</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Orientación</label>
              <select value={cfg.orientacion} onChange={e => set("orientacion", e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm outline-none">
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Opciones de visualización */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Mostrar en catálogo</h3>
        <div className="space-y-2">
          {toggle("Precios", "mostrarPrecios")}
          {toggle("Código de producto", "mostrarCodigo")}
          {toggle("Stock disponible", "mostrarStock")}
          {toggle("QR de WhatsApp", "mostrarQrWhatsapp")}
          {toggle("QR del sitio web", "mostrarQrWeb")}
        </div>
      </div>
    </div>
  );
}

// ─── Product Selector ─────────────────────────────────────────────────────────
function ProductSelector({ products, cfg, onChange }: { products: Product[]; cfg: CatalogConfig; onChange: (c: CatalogConfig) => void }) {
  const [search, setSearch] = useState("");
  const filtered = products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()));

  function toggle(id: number) {
    const sel = cfg.productosSeleccionados.includes(id)
      ? cfg.productosSeleccionados.filter(x => x !== id)
      : [...cfg.productosSeleccionados, id];
    const orden = sel.includes(id)
      ? [...cfg.ordenProductos, id]
      : cfg.ordenProductos.filter(x => x !== id);
    onChange({ ...cfg, productosSeleccionados: sel, ordenProductos: orden });
  }

  function toggleAll() {
    const allSelected = products.every(p => cfg.productosSeleccionados.includes(p.id));
    if (allSelected) {
      onChange({ ...cfg, productosSeleccionados: [], ordenProductos: [] });
    } else {
      const ids = products.map(p => p.id);
      onChange({ ...cfg, productosSeleccionados: ids, ordenProductos: ids });
    }
  }

  function moveUp(id: number) {
    const idx = cfg.ordenProductos.indexOf(id);
    if (idx <= 0) return;
    const arr = [...cfg.ordenProductos];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onChange({ ...cfg, ordenProductos: arr });
  }

  function moveDown(id: number) {
    const idx = cfg.ordenProductos.indexOf(id);
    if (idx < 0 || idx >= cfg.ordenProductos.length - 1) return;
    const arr = [...cfg.ordenProductos];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onChange({ ...cfg, ordenProductos: arr });
  }

  const selectedProducts = cfg.ordenProductos
    .map(id => products.find(p => p.id === id))
    .filter(Boolean) as Product[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={toggleAll} className="text-xs text-emerald-600 hover:underline whitespace-nowrap">
          {products.every(p => cfg.productosSeleccionados.includes(p.id)) ? "Deseleccionar todo" : "Seleccionar todo"}
        </button>
      </div>

      <p className="text-xs text-gray-400">{cfg.productosSeleccionados.length} de {products.length} productos seleccionados</p>

      {/* Available products */}
      <div className="border rounded-xl divide-y max-h-64 overflow-y-auto">
        {filtered.map(p => (
          <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={cfg.productosSeleccionados.includes(p.id)}
              onChange={() => toggle(p.id)} className="rounded" />
            {p.imagen && <img src={p.imagen} alt="" className="w-8 h-8 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
              {p.categoria && <p className="text-xs text-gray-400">{p.categoria}</p>}
            </div>
            {p.precio && <span className="text-xs text-gray-500 shrink-0">{fmt(p.precio, "ARS")}</span>}
          </label>
        ))}
      </div>

      {/* Order */}
      {selectedProducts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Orden en el catálogo</h4>
          <div className="border rounded-xl divide-y">
            {selectedProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                <GripVertical size={14} className="text-gray-300" />
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <span className="text-sm flex-1 truncate">{p.nombre}</span>
                <button onClick={() => moveUp(p.id)} disabled={i === 0}
                  className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => moveDown(p.id)} disabled={i === selectedProducts.length - 1}
                  className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronDown size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CatalogosPage() {
  const [tipo, setTipo] = useState<"ar" | "usa">("ar");
  const [cfgAR, setCfgAR] = useState<CatalogConfig>(DEFAULT_CONFIG);
  const [cfgUSA, setCfgUSA] = useState<CatalogConfig>(DEFAULT_CONFIG_USA);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activePanel, setActivePanel] = useState<"config" | "products" | "preview">("config");

  const cfg = tipo === "ar" ? cfgAR : cfgUSA;
  const setCfg = tipo === "ar" ? setCfgAR : setCfgUSA;

  useEffect(() => {
    Promise.all([
      fetch("/api/catalogos").then(r => r.ok ? r.json() : {}),
      fetch("/api/productos").then(r => r.ok ? r.json() : []),
    ]).then(([configs, prods]) => {
      const c = configs as Record<string, any>;
      if (c.ar) setCfgAR({ ...DEFAULT_CONFIG, ...c.ar, preciosCustom: c.ar.preciosCustom ?? {} });
      if (c.usa) setCfgUSA({ ...DEFAULT_CONFIG_USA, ...c.usa, preciosCustom: c.usa.preciosCustom ?? {} });
      // Extract products from response format
      const list = Array.isArray(prods) ? prods : (prods.products ?? prods.data ?? []);
      setProducts(list.map((p: any) => ({
        id: p.id,
        nombre: p.name ?? p.nombre ?? "",
        slug: p.slug ?? "",
        descripcion: p.description ?? p.descripcion ?? null,
        precio: p.variants?.[0]?.price != null ? Number(p.variants[0].price)
          : p.precio != null ? Number(p.precio) : null,
        sku: p.sku ?? null,
        imagen: p.imageUrls?.[0] ?? p.imageUrl ?? p.imagen ?? null,
        categoria: p.category?.name ?? p.categoria ?? null,
        stock: p.stock != null ? Number(p.stock) : null,
      })));
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/catalogos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, config: cfg }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function generatePDF() {
    setGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { toJpeg } = await import("html-to-image");
      const el = document.getElementById("catalog-preview");
      if (!el) return;

      // Proxy cross-origin images to data URLs so html-to-image can embed them
      const imgs = Array.from(el.querySelectorAll("img")) as HTMLImageElement[];
      const origSrcs: string[] = [];
      await Promise.all(imgs.map(async (img, i) => {
        origSrcs[i] = img.src;
        if (!img.src.startsWith("http")) return;
        try {
          const res = await fetch(`/api/imagen-proxy?url=${encodeURIComponent(img.src)}`);
          if (!res.ok) return;
          const blob = await res.blob();
          await new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => { img.src = reader.result as string; resolve(); };
            reader.onerror = () => resolve();
            reader.readAsDataURL(blob);
          });
        } catch { /* keep original */ }
      }));

      // Temporarily remove decorative styles that distort layout
      const savedStyle = el.getAttribute("style") || "";
      el.style.maxWidth = "";
      el.style.margin = "0";
      el.style.borderRadius = "0";
      el.style.boxShadow = "none";
      el.style.border = "none";

      // html-to-image uses SVG foreignObject — the browser renders CSS natively,
      // so oklch/oklab/color-mix work without any patching.
      const imgData = await toJpeg(el, { quality: 0.92, pixelRatio: 2, skipFonts: false });

      // Restore
      el.setAttribute("style", savedStyle);
      imgs.forEach((img, i) => { img.src = origSrcs[i]; });

      const isHoriz = cfg.orientacion === "horizontal";
      const fmtDims = cfg.formato === "carta" ? [215.9, 279.4] : [210, 297];
      const pdfW = isHoriz ? fmtDims[1] : fmtDims[0];

      // Determine image dimensions from data URL
      const imgEl = await new Promise<HTMLImageElement>((resolve) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.src = imgData;
      });
      const imgH = pdfW * (imgEl.naturalHeight / imgEl.naturalWidth);

      const pdf = new jsPDF({
        orientation: isHoriz ? "landscape" : "portrait",
        unit: "mm",
        format: [pdfW, imgH],
      });
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, imgH);

      const filename = tipo === "usa" ? "wholesale-catalog.pdf" : "catalogo-argentina.pdf";
      pdf.save(filename);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("No se pudo generar el PDF. Revisá la consola para más detalles.");
    } finally {
      setGenerating(false);
    }
  }

  function printCatalog() {
    // Use @media print on the current page — avoids missing CSS issues
    const styleId = "catalog-print-style";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #catalog-print-root { display: block !important; }
        #catalog-print-root * { display: revert !important; }
      }
    `;

    const el = document.getElementById("catalog-preview");
    if (!el) return;

    // Wrap in a top-level print container
    let root = document.getElementById("catalog-print-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "catalog-print-root";
      root.style.display = "none";
      document.body.appendChild(root);
    }
    root.innerHTML = "";
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.maxWidth = "none";
    clone.style.margin = "0";
    clone.style.borderRadius = "0";
    clone.style.boxShadow = "none";
    clone.style.border = "none";
    root.appendChild(clone);

    window.print();

    // Cleanup after print dialog closes
    setTimeout(() => {
      root!.innerHTML = "";
      style!.textContent = "";
    }, 1000);
  }

  function exportHTML() {
    const el = document.getElementById("catalog-preview");
    if (!el) return;
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Catálogo</title></head><body style="background:#f9f9f9;padding:20px">${el.outerHTML}</body></html>`], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = tipo === "usa" ? "wholesale-catalog.html" : "catalogo.html";
    a.click();
  }

  const panelBtn = (id: typeof activePanel, label: string, Icon: any) => (
    <button key={id} onClick={() => setActivePanel(id)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activePanel === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={22} className="text-emerald-600" /> Catálogos
          </h1>
          <p className="text-sm text-gray-500 mt-1">Generá catálogos profesionales en PDF</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium">
            {saved ? <><Check size={15} /> Guardado</> : <><Check size={15} /> {saving ? "Guardando..." : "Guardar"}</>}
          </button>
        </div>
      </div>

      {/* Catalog type tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setTipo("ar")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tipo === "ar" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          🇦🇷 Catálogo Argentina
        </button>
        <button onClick={() => setTipo("usa")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tipo === "usa" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          🇺🇸 Wholesale Catalog USA
        </button>
      </div>

      <div className="flex gap-6">
        {/* Left panel */}
        <div className="w-80 shrink-0 space-y-4">
          {/* Panel switcher */}
          <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
            {panelBtn("config", "Configurar", Settings)}
            {panelBtn("products", "Productos", Package)}
          </div>

          <div className="bg-white rounded-2xl border p-4 max-h-[calc(100vh-280px)] overflow-y-auto">
            {activePanel === "config" && <ConfigPanel cfg={cfg} onChange={setCfg} products={products} />}
            {activePanel === "products" && (
              loading ? <p className="text-sm text-gray-400 py-4 text-center">Cargando productos...</p>
                : <ProductSelector products={products} cfg={cfg} onChange={setCfg} />
            )}
          </div>

          {/* Export buttons */}
          <div className="bg-white rounded-2xl border p-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Exportar</h3>
            <button onClick={generatePDF} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium">
              <Download size={15} /> {generating ? "Generando PDF..." : "Generar PDF"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={exportHTML}
                className="flex items-center justify-center gap-1.5 border rounded-xl py-2 text-xs hover:bg-gray-50">
                <Globe size={12} /> HTML
              </button>
              <button onClick={printCatalog}
                className="flex items-center justify-center gap-1.5 border rounded-xl py-2 text-xs hover:bg-gray-50">
                <Printer size={12} /> Imprimir
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Eye size={15} className="text-gray-400" /> Vista previa
            </p>
            <span className="text-xs text-gray-400">
              {cfg.productosSeleccionados.length} productos · {cfg.formato} {cfg.orientacion}
            </span>
          </div>
          <div className="overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>
            ) : (
              <CatalogPreview cfg={cfg} products={products} tipo={tipo} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
