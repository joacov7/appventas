"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Type, Image as ImageIcon, Trash2, RotateCcw, AlignCenter, Bold, Minus, Plus } from "lucide-react";

interface Virola {
  id: number;
  nombre: string;
  slug: string;
  material: string;
  diametroMm: number;
  precioBase: string;
  imageUrl: string | null;
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

  // Load fabric dynamically (avoids SSR issues)
  useEffect(() => {
    let cancelled = false;
    import("fabric").then(({ Canvas, Circle, IText, FabricImage }) => {
      if (cancelled || !canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: "#ffffff",
      });

      // Circular clip path
      const clipCircle = new Circle({
        radius: RING_OUTER,
        originX: "center",
        originY: "center",
        left: CANVAS_SIZE / 2,
        top: CANVAS_SIZE / 2,
        absolutePositioned: true,
      });
      canvas.clipPath = clipCircle;

      // Draw ring guide (visual only - not a canvas object, drawn via overlay)
      canvas.on("after:render", ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
        ctx.save();
        // Outer ring guide
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_OUTER, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(16,185,129,0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        // Inner hole guide
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_INNER, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(239,68,68,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });

      canvas.on("selection:created", (e: any) => {
        const obj = e.selected?.[0];
        setSelectedObj(obj);
        if (obj?.type === "i-text") {
          setFontSize(obj.fontSize ?? 24);
          setFontFamily(obj.fontFamily ?? "Arial");
          setTextColor(obj.fill ?? "#1a1a1a");
        }
      });
      canvas.on("selection:updated", (e: any) => {
        const obj = e.selected?.[0];
        setSelectedObj(obj);
        if (obj?.type === "i-text") {
          setFontSize(obj.fontSize ?? 24);
          setFontFamily(obj.fontFamily ?? "Arial");
          setTextColor(obj.fill ?? "#1a1a1a");
        }
      });
      canvas.on("selection:cleared", () => setSelectedObj(null));

      fabricRef.current = { canvas, IText, FabricImage };
      setFabricLoaded(true);
    });
    return () => { cancelled = true; fabricRef.current?.canvas?.dispose(); };
  }, []);

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
      const scale = Math.min((RING_OUTER * 1.5) / (img.width ?? 1), (RING_OUTER * 1.5) / (img.height ?? 1));
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

  const handleAddToCart = useCallback(async () => {
    const { canvas } = fabricRef.current ?? {};
    if (!canvas) return;
    // Generate preview PNG (with guides hidden)
    canvas.clipPath = undefined;
    canvas.renderAll();
    const preview = canvas.toDataURL({ format: "png", multiplier: 0.5 });
    const datos = canvas.toJSON();
    // Restore clip
    const { Circle } = await import("fabric");
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

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Toolbar */}
      <div className="lg:w-64 space-y-5 shrink-0">
        {/* Add text */}
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            <Type size={15} /> Agregar texto
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
            <label className="text-xs text-gray-500">Tamaño</label>
            <input
              type="range" min="8" max="72" value={fontSize}
              onChange={(e) => { setFontSize(Number(e.target.value)); updateSelected("fontSize", Number(e.target.value)); }}
              className="flex-1"
            />
            <span className="text-xs w-6 text-right">{fontSize}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Color</label>
            <input
              type="color" value={textColor}
              onChange={(e) => { setTextColor(e.target.value); updateSelected("fill", e.target.value); }}
              className="w-8 h-8 rounded cursor-pointer border-0"
            />
            <span className="text-xs text-gray-500">{textColor}</span>
          </div>
          <button
            onClick={addText}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Agregar texto
          </button>
        </div>

        {/* Add image */}
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-3">
            <ImageIcon size={15} /> Agregar imagen / logo
          </h3>
          <button
            onClick={addImage}
            className="w-full border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 py-3 rounded-xl text-sm transition-colors"
          >
            Subir imagen
          </button>
        </div>

        {/* Object controls */}
        {selectedObj && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Objeto seleccionado</h3>
            <div className="flex gap-2">
              <button
                onClick={() => { const a = fabricRef.current?.canvas?.getActiveObject(); if (a) { a.centerH(); fabricRef.current?.canvas?.renderAll(); } }}
                className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-2 text-xs hover:bg-gray-50"
              >
                <AlignCenter size={12} /> Centrar H
              </button>
              <button
                onClick={() => { const a = fabricRef.current?.canvas?.getActiveObject(); if (a) { a.centerV(); fabricRef.current?.canvas?.renderAll(); } }}
                className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-2 text-xs hover:bg-gray-50"
              >
                <AlignCenter size={12} /> Centrar V
              </button>
            </div>
            <button
              onClick={deleteSelected}
              className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-xl text-sm transition-colors"
            >
              <Trash2 size={14} /> Eliminar elemento
            </button>
          </div>
        )}

        {/* Actions */}
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
          <div className="border-t pt-3">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-500">Total</span>
              <span className="font-bold">${(Number(virola.precioBase) * quantity).toLocaleString("es-AR")}</span>
            </div>
            <button
              onClick={handleAddToCart}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
                added
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {added ? "¡Agregado al carrito!" : "Agregar al carrito"}
            </button>
          </div>
          <button
            onClick={clearCanvas}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 text-xs py-1"
          >
            <RotateCcw size={12} /> Limpiar diseño
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col items-center">
        <div className="bg-gray-50 rounded-2xl p-4 border w-full flex items-center justify-center min-h-[540px]">
          {!fabricLoaded && (
            <div className="text-gray-400 text-sm">Cargando editor...</div>
          )}
          <div style={{ display: fabricLoaded ? "block" : "none" }}>
            <canvas ref={canvasRef} />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-emerald-400" /> Borde exterior ({virola.diametroMm}mm)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-red-400" /> Orificio
          </span>
        </div>
      </div>
    </div>
  );
}
