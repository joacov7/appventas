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
  logo: null, empresa: "", slogan: "", whatsapp: "", instagram: "",
  facebook: "", sitioWeb: "", email: "", direccion: "", quienesSomos: "",
  mostrarPrecios: true, mostrarCodigo: true, mostrarStock: false,
  mostrarQrWhatsapp: true, mostrarQrWeb: false,
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
      className="relative w-full flex flex-col items-center justify-center text-white overflow-hidden"
      style={{ height: 480, background: `linear-gradient(135deg, ${cfg.colorPrincipal} 0%, ${cfg.colorSecundario} 100%)` }}
    >
      {cfg.logo && (
        <img src={cfg.logo} alt="logo" className="h-20 object-contain mb-6 drop-shadow-lg" />
      )}
      <h1 className="text-4xl font-bold text-center px-8 drop-shadow">{cfg.empresa || (tipo === "usa" ? "Premium Mate Collection" : "Catálogo de Productos")}</h1>
      {cfg.slogan && <p className="mt-3 text-lg text-white/80 text-center px-8">{cfg.slogan}</p>}
      {tipo === "usa" && (
        <div className="mt-6 flex flex-wrap gap-2 justify-center px-8">
          {["Made in Argentina", "Wholesale", "Private Label", "Laser Engraving", "Worldwide Shipping"].map(t => (
            <span key={t} className="text-xs border border-white/40 text-white px-3 py-1 rounded-full">{t}</span>
          ))}
        </div>
      )}
      <div className="absolute bottom-4 right-6 text-white/50 text-xs">{new Date().toLocaleDateString(tipo === "usa" ? "en-US" : "es-AR")}</div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ p, cfg, tipo, index }: { p: Product; cfg: CatalogConfig; tipo: "ar" | "usa"; index: number }) {
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="aspect-square bg-gray-50 overflow-hidden">
        {p.imagen ? (
          <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Package size={40} strokeWidth={1} />
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
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          {cfg.mostrarPrecios && p.precio ? (
            <span className="font-bold text-base" style={{ color: cfg.colorSecundario }}>
              {fmt(p.precio, cfg.moneda)}
            </span>
          ) : <span />}
          {cfg.mostrarStock && (
            <span className="text-xs text-gray-400">Stock: {p.stock ?? "—"}</span>
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
            {selected.map((p, i) => <ProductCard key={p.id} p={p} cfg={cfg} tipo={tipo} index={i} />)}
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
function ConfigPanel({ cfg, onChange }: { cfg: CatalogConfig; onChange: (c: CatalogConfig) => void }) {
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
      if (c.ar) setCfgAR({ ...DEFAULT_CONFIG, ...c.ar });
      if (c.usa) setCfgUSA({ ...DEFAULT_CONFIG_USA, ...c.usa });
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
        imagen: p.imageUrl ?? p.imagen ?? null,
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
      const { default: html2canvas } = await import("html2canvas");
      const el = document.getElementById("catalog-preview");
      if (!el) return;

      const isHoriz = cfg.orientacion === "horizontal";
      const fmt = cfg.formato === "carta" ? [215.9, 279.4] : [210, 297];
      const pdf = new jsPDF({
        orientation: isHoriz ? "landscape" : "portrait",
        unit: "mm",
        format: fmt as any,
      });

      const pdfW = isHoriz ? fmt[1] : fmt[0];
      const pdfH = isHoriz ? fmt[0] : fmt[1];

      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const ratio = canvas.width / canvas.height;
      const imgH = pdfW / ratio;

      let y = 0;
      let page = 0;
      while (y < imgH) {
        if (page > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -y, pdfW, imgH);
        // Page number
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`${page + 1}`, pdfW - 10, pdfH - 5);
        y += pdfH;
        page++;
      }

      const filename = tipo === "usa" ? "wholesale-catalog.pdf" : "catalogo-argentina.pdf";
      pdf.save(filename);
    } finally {
      setGenerating(false);
    }
  }

  function printCatalog() {
    const el = document.getElementById("catalog-preview");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Catálogo</title><style>body{margin:0}@media print{.no-print{display:none}}</style></head><body>${el.outerHTML}</body></html>`);
    win.document.close();
    win.print();
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
            {activePanel === "config" && <ConfigPanel cfg={cfg} onChange={setCfg} />}
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
