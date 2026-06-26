"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Type, Image as ImageIcon, Trash2, RotateCcw, AlignCenter,
  Minus, Plus, Download, FileText, File, ShoppingCart
} from "lucide-react";

interface Virola {
  id: number;
  nombre: string;
  slug: string;
  material: string;
  diametroMm: number;
  precioBase: string;
  imageUrl: string | null;
}

interface PerfilLaser {
  id: number;
  nombre: string;
  material: string;
  potencia: number;
  velocidad: number;
  pasadas: number;
  notas: string | null;
}

interface VirolaCanvasProps {
  virola: Virola;
  onAddToCart: (preview: string, datos: object) => void;
}

const CANVAS_SIZE = 500;
const RING_OUTER = 220;
const RING_INNER = 80;

export function VirolaCanvas({ virola, onAddToCart }: VirolaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [selectedObj, setSelectedObj] = useState<any>(null);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [textInput, setTextInput] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [perfiles, setPerfiles] = useState<PerfilLaser[]>([]);
  const [perfilId, setPerfilId] = useState<number | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Cargar perfiles de láser
  useEffect(() => {
    fetch("/api/virolas/perfiles")
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const filtered = data.filter((p: PerfilLaser) =>
          p.material === "todos" || p.material.toLowerCase() === virola.material.toLowerCase()
        );
        setPerfiles(filtered);
        if (filtered.length > 0) setPerfilId(filtered[0].id);
      });
  }, [virola.material]);

  // Inicializar Fabric.js
  useEffect(() => {
    let cancelled = false;
    import("fabric").then(({ Canvas, Circle, IText, FabricImage }) => {
      if (cancelled || !canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: "#ffffff",
      });

      // Clip circular
      const clipCircle = new Circle({
        radius: RING_OUTER,
        originX: "center",
        originY: "center",
        left: CANVAS_SIZE / 2,
        top: CANVAS_SIZE / 2,
        absolutePositioned: true,
      });
      canvas.clipPath = clipCircle;

      // Guías dibujadas como overlay
      canvas.on("after:render", ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_OUTER, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(16,185,129,0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_INNER, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(239,68,68,0.45)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });

      canvas.on("selection:created", (e: any) => syncSelection(e.selected?.[0]));
      canvas.on("selection:updated", (e: any) => syncSelection(e.selected?.[0]));
      canvas.on("selection:cleared", () => setSelectedObj(null));

      function syncSelection(obj: any) {
        setSelectedObj(obj);
        if (obj?.type === "i-text") {
          setFontSize(obj.fontSize ?? 24);
          setFontFamily(obj.fontFamily ?? "Arial");
          setTextColor(obj.fill ?? "#1a1a1a");
        }
      }

      fabricRef.current = { canvas, IText, FabricImage, Circle };
      setFabricLoaded(true);
    });
    return () => {
      cancelled = true;
      fabricRef.current?.canvas?.dispose();
    };
  }, []);

  // ── Acciones del editor ────────────────────────────────────────────────────

  const addText = useCallback(() => {
    const { canvas, IText } = fabricRef.current ?? {};
    if (!canvas || !IText) return;
    const text = textInput.trim() || "Tu texto";
    const obj = new IText(text, {
      left: CANVAS_SIZE / 2,
      top: CANVAS_SIZE / 2,
      originX: "center",
      originY: "center",
      fontSize,
      fontFamily,
      fill: textColor,
      editable: true,
    });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();
    setTextInput("");
  }, [textInput, fontSize, fontFamily, textColor]);

  const addImage = useCallback(() => {
    const { canvas, FabricImage } = fabricRef.current ?? {};
    if (!canvas || !FabricImage) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = await FabricImage.fromURL(url);
      const scale = Math.min(
        (RING_OUTER * 1.5) / (img.width ?? 1),
        (RING_OUTER * 1.5) / (img.height ?? 1)
      );
      img.scale(scale);
      img.set({ left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2, originX: "center", originY: "center" });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    };
    input.click();
  }, []);

  const deleteSelected = useCallback(() => {
    const { canvas } = fabricRef.current ?? {};
    const obj = canvas?.getActiveObject();
    if (obj) { canvas.remove(obj); canvas.renderAll(); }
  }, []);

  const clearCanvas = useCallback(() => {
    const { canvas } = fabricRef.current ?? {};
    if (!canvas) return;
    if (!confirm("¿Limpiar todo el diseño?")) return;
    canvas.getObjects().forEach((o: any) => canvas.remove(o));
    canvas.renderAll();
  }, []);

  const updateSelected = useCallback((prop: string, value: any) => {
    const { canvas } = fabricRef.current ?? {};
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    obj.set(prop, value);
    canvas.renderAll();
  }, []);

  // ── Exportaciones ──────────────────────────────────────────────────────────

  async function withExport(key: string, fn: () => Promise<void>) {
    setExporting(key);
    try { await fn(); } finally { setExporting(null); }
  }

  const handleExportSVG = () => withExport("svg", async () => {
    const { exportSVG } = await import("@/lib/virola-exports");
    exportSVG(fabricRef.current?.canvas, virola);
  });

  const handleExportDXF = () => withExport("dxf", async () => {
    const { exportDXF } = await import("@/lib/virola-exports");
    exportDXF(fabricRef.current?.canvas, virola);
  });

  const handleExportPNG = () => withExport("png", async () => {
    const { exportPNG } = await import("@/lib/virola-exports");
    exportPNG(fabricRef.current?.canvas, virola);
  });

  const handleExportPDF = () => withExport("pdf", async () => {
    const { exportPDF } = await import("@/lib/virola-exports");
    const perfil = perfiles.find(p => p.id === perfilId) ?? null;
    await exportPDF(fabricRef.current?.canvas, virola, quantity, perfil);
  });

  // ── Agregar al carrito ─────────────────────────────────────────────────────

  const handleAddToCart = useCallback(async () => {
    const { canvas, Circle } = fabricRef.current ?? {};
    if (!canvas) return;
    canvas.clipPath = undefined;
    canvas.renderAll();
    const preview = canvas.toDataURL({ format: "png", multiplier: 0.5 });
    const datos = canvas.toJSON();
    canvas.clipPath = new Circle({
      radius: RING_OUTER, originX: "center", originY: "center",
      left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2, absolutePositioned: true,
    });
    canvas.renderAll();
    onAddToCart(preview, { ...datos, quantity });
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  }, [onAddToCart, quantity]);

  const FONTS = ["Arial", "Georgia", "Courier New", "Times New Roman", "Verdana", "Impact", "Palatino"];
  const perfilActual = perfiles.find(p => p.id === perfilId);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ── Toolbar izquierdo ── */}
      <div className="lg:w-64 space-y-4 shrink-0">

        {/* Texto */}
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            <Type size={15} /> Texto
          </h3>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addText()}
            placeholder="Escribí tu texto..."
            className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={fontFamily}
            onChange={(e) => { setFontFamily(e.target.value); updateSelected("fontFamily", e.target.value); }}
            className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-12">Tamaño</label>
            <input
              type="range" min="8" max="72" value={fontSize}
              onChange={(e) => { setFontSize(Number(e.target.value)); updateSelected("fontSize", Number(e.target.value)); }}
              className="flex-1"
            />
            <span className="text-xs w-6 text-right">{fontSize}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-12">Color</label>
            <input
              type="color" value={textColor}
              onChange={(e) => { setTextColor(e.target.value); updateSelected("fill", e.target.value); }}
              className="w-8 h-8 rounded cursor-pointer border-0"
            />
            <span className="text-xs text-gray-400">{textColor}</span>
          </div>
          <button
            onClick={addText}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Agregar texto
          </button>
        </div>

        {/* Imagen */}
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-3">
            <ImageIcon size={15} /> Imagen / Logo
          </h3>
          <button
            onClick={addImage}
            className="w-full border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 py-3 rounded-xl text-sm transition-colors"
          >
            Subir desde dispositivo
          </button>
        </div>

        {/* Objeto seleccionado */}
        {selectedObj && (
          <div className="bg-white rounded-2xl border p-4 space-y-2">
            <h3 className="font-semibold text-sm text-gray-900">Elemento seleccionado</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { const a = fabricRef.current?.canvas?.getActiveObject(); if (a) { a.centerH(); fabricRef.current?.canvas?.renderAll(); } }}
                className="flex items-center justify-center gap-1 border rounded-lg py-2 text-xs hover:bg-gray-50"
              >
                <AlignCenter size={11} /> Centro H
              </button>
              <button
                onClick={() => { const a = fabricRef.current?.canvas?.getActiveObject(); if (a) { a.centerV(); fabricRef.current?.canvas?.renderAll(); } }}
                className="flex items-center justify-center gap-1 border rounded-lg py-2 text-xs hover:bg-gray-50"
              >
                <AlignCenter size={11} className="rotate-90" /> Centro V
              </button>
            </div>
            <button
              onClick={deleteSelected}
              className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-xl text-sm transition-colors"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        )}

        {/* Perfil de láser */}
        {perfiles.length > 0 && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Perfil de láser</h3>
            <select
              value={perfilId ?? ""}
              onChange={(e) => setPerfilId(Number(e.target.value))}
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
            >
              {perfiles.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            {perfilActual && (
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
                <p>⚡ Potencia: <strong>{perfilActual.potencia}%</strong></p>
                <p>💨 Velocidad: <strong>{perfilActual.velocidad} mm/s</strong></p>
                <p>🔁 Pasadas: <strong>{perfilActual.pasadas}</strong></p>
                {perfilActual.notas && <p className="text-gray-400 italic">{perfilActual.notas}</p>}
              </div>
            )}
          </div>
        )}

        {/* Exportar */}
        <div className="bg-white rounded-2xl border p-4 space-y-2">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-1">
            <Download size={15} /> Exportar diseño
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportPNG}
              disabled={!!exporting}
              className="flex items-center justify-center gap-1.5 border rounded-xl py-2 text-xs hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Download size={12} /> {exporting === "png" ? "..." : "PNG"}
            </button>
            <button
              onClick={handleExportSVG}
              disabled={!!exporting}
              className="flex items-center justify-center gap-1.5 border rounded-xl py-2 text-xs hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <File size={12} /> {exporting === "svg" ? "..." : "SVG"}
            </button>
            <button
              onClick={handleExportDXF}
              disabled={!!exporting}
              className="flex items-center justify-center gap-1.5 border border-orange-200 text-orange-700 rounded-xl py-2 text-xs hover:bg-orange-50 disabled:opacity-50 transition-colors"
            >
              <File size={12} /> {exporting === "dxf" ? "..." : "DXF Láser"}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={!!exporting}
              className="flex items-center justify-center gap-1.5 border border-blue-200 text-blue-700 rounded-xl py-2 text-xs hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              <FileText size={12} /> {exporting === "pdf" ? "..." : "PDF Orden"}
            </button>
          </div>
        </div>

        {/* Cantidad y carrito */}
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Cantidad</span>
            <div className="flex items-center gap-2 border rounded-xl">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-2.5 py-1.5 hover:bg-gray-50 rounded-l-xl">
                <Minus size={12} />
              </button>
              <span className="text-sm w-6 text-center font-medium">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="px-2.5 py-1.5 hover:bg-gray-50 rounded-r-xl">
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">Total</span>
            <span className="font-bold">${(Number(virola.precioBase) * quantity).toLocaleString("es-AR")}</span>
          </div>
          <button
            onClick={handleAddToCart}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              added
                ? "bg-emerald-100 text-emerald-700"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            <ShoppingCart size={16} />
            {added ? "¡Agregado!" : "Agregar al carrito"}
          </button>
          <button
            onClick={clearCanvas}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 text-xs py-1"
          >
            <RotateCcw size={12} /> Limpiar diseño
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 flex flex-col items-center">
        <div className="bg-gray-50 rounded-2xl p-4 border w-full flex items-center justify-center min-h-[540px]">
          {!fabricLoaded && (
            <div className="text-gray-400 text-sm">Cargando editor...</div>
          )}
          <div style={{ display: fabricLoaded ? "block" : "none" }}>
            <canvas ref={canvasRef} />
          </div>
        </div>
        <div className="flex items-center gap-5 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-emerald-400" />
            Borde exterior ({virola.diametroMm}mm)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-red-400" />
            Orificio
          </span>
        </div>
      </div>
    </div>
  );
}
