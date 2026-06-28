"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Type, Image as ImageIcon, Trash2, RotateCcw, AlignCenter,
  Minus, Plus, Download, FileText, File, ShoppingCart,
  Undo2, Redo2, RefreshCw, Layers, Eye,
} from "lucide-react";

interface Virola {
  id: number;
  nombre: string;
  slug: string;
  material: string;
  diametroMm: number;
  precioBase: string;
  imageUrl: string | null;
  disenoBase?: string | null;
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

// Material → color de fondo predeterminado
const MATERIAL_COLORS: Record<string, string> = {
  "madera":            "#c8a97a",
  "acero inoxidable":  "#d0d0d0",
  "alpaca":            "#b8c0c8",
  "cobre":             "#b87333",
  "latón":             "#c5a028",
};

// Plantillas prediseñadas
const TEMPLATES = [
  {
    id: "nombre-central",
    label: "Nombre central",
    thumb: "N",
    build: (IText: any, size: number) => [
      new IText("Tu Nombre", {
        left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2,
        originX: "center", originY: "center",
        fontSize: size, fontFamily: "Georgia", fill: "#1a1a1a",
      }),
    ],
  },
  {
    id: "fecha",
    label: "Fecha especial",
    thumb: "♡",
    build: (IText: any) => [
      new IText("♡", { left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2 - 30, originX: "center", originY: "center", fontSize: 36, fontFamily: "Arial", fill: "#c0392b" }),
      new IText("01 · 01 · 2025", { left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2 + 20, originX: "center", originY: "center", fontSize: 20, fontFamily: "Courier New", fill: "#333" }),
    ],
  },
  {
    id: "iniciales",
    label: "Iniciales",
    thumb: "AB",
    build: (IText: any) => [
      new IText("A", { left: CANVAS_SIZE / 2 - 22, top: CANVAS_SIZE / 2, originX: "center", originY: "center", fontSize: 64, fontFamily: "Georgia", fill: "#1a1a1a", fontStyle: "italic" }),
      new IText("B", { left: CANVAS_SIZE / 2 + 22, top: CANVAS_SIZE / 2, originX: "center", originY: "center", fontSize: 64, fontFamily: "Georgia", fill: "#555", fontStyle: "italic" }),
    ],
  },
  {
    id: "mate",
    label: "¡Salud!",
    thumb: "🧉",
    build: (IText: any) => [
      new IText("🧉", { left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2 - 20, originX: "center", originY: "center", fontSize: 48, fontFamily: "Arial" }),
      new IText("¡Salud!", { left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2 + 38, originX: "center", originY: "center", fontSize: 22, fontFamily: "Georgia", fill: "#2d6a4f", fontStyle: "italic" }),
    ],
  },
];

export function VirolaCanvas({ virola, onAddToCart }: VirolaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const blockHistoryRef = useRef(false);

  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [selectedObj, setSelectedObj] = useState<any>(null);
  const [fontSize, setFontSize] = useState(28);
  const [fontFamily, setFontFamily] = useState("Georgia");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [textInput, setTextInput] = useState("");
  const [arcText, setArcText] = useState("");
  const [arcRadius, setArcRadius] = useState(160);
  const [arcAngle, setArcAngle] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [perfiles, setPerfiles] = useState<PerfilLaser[]>([]);
  const [perfilId, setPerfilId] = useState<number | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState(() => MATERIAL_COLORS[virola.material] ?? "#e8dcc8");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "arc" | "image" | "templates" | "bg">("templates");
  const [selectedScale, setSelectedScale] = useState(1);
  const [selectedAngle, setSelectedAngle] = useState(0);

  // Verificar si es admin
  useEffect(() => {
    fetch("/api/auth/check").then(r => r.json()).then(d => setIsAdmin(!!d.admin)).catch(() => {});
  }, []);

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

  // ── Historial (undo/redo) ──────────────────────────────────────────────────
  function pushHistory() {
    if (blockHistoryRef.current) return;
    const canvas = fabricRef.current?.canvas;
    if (!canvas) return;
    const state = JSON.stringify(canvas.toJSON());
    const idx = historyIdxRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(state);
    historyIdxRef.current = historyRef.current.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }

  const undo = useCallback(() => {
    const canvas = fabricRef.current?.canvas;
    if (!canvas || historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    blockHistoryRef.current = true;
    canvas.loadFromJSON(historyRef.current[historyIdxRef.current]).then(() => {
      canvas.renderAll();
      blockHistoryRef.current = false;
      setCanUndo(historyIdxRef.current > 0);
      setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
    });
  }, []);

  const redo = useCallback(() => {
    const canvas = fabricRef.current?.canvas;
    if (!canvas || historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    blockHistoryRef.current = true;
    canvas.loadFromJSON(historyRef.current[historyIdxRef.current]).then(() => {
      canvas.renderAll();
      blockHistoryRef.current = false;
      setCanUndo(historyIdxRef.current > 0);
      setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
    });
  }, []);

  // ── Inicializar Fabric.js ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    import("fabric").then(({ Canvas, Circle, IText, FabricImage, Rect }) => {
      if (cancelled || !canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: bgColor,
        selectionColor: "rgba(0,255,65,0.08)",
        selectionBorderColor: "#00ff41",
        selectionLineWidth: 1,
      });

      // Clip circular (borde exterior)
      const clipCircle = new Circle({
        radius: RING_OUTER,
        originX: "center", originY: "center",
        left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2,
        absolutePositioned: true,
      });
      canvas.clipPath = clipCircle;

      // Overlay: anillo exterior + agujero central
      canvas.on("after:render", ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
        ctx.save();

        // Agujero central (compositing)
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_INNER, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        // Borde del agujero
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_INNER, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(100,100,100,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Borde exterior
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, RING_OUTER, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(100,100,100,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      });

      canvas.on("selection:created", (e: any) => syncSelection(e.selected?.[0]));
      canvas.on("selection:updated", (e: any) => syncSelection(e.selected?.[0]));
      canvas.on("selection:cleared", () => setSelectedObj(null));

      function syncSelection(obj: any) {
        setSelectedObj(obj ?? null);
        if (obj) {
          setSelectedScale(obj.scaleX ?? 1);
          setSelectedAngle(obj.angle ?? 0);
        }
        if (obj?.type === "i-text") {
          setFontSize(obj.fontSize ?? 28);
          setFontFamily(obj.fontFamily ?? "Georgia");
          setTextColor(obj.fill ?? "#1a1a1a");
        }
      }

      // Guardar historial en cada modificación
      canvas.on("object:modified", (e: any) => {
        pushHistory();
        const obj = e.target;
        if (obj) {
          setSelectedScale(obj.scaleX ?? 1);
          setSelectedAngle(Math.round(obj.angle ?? 0));
        }
      });
      canvas.on("object:removed", () => pushHistory());

      // Apply neon green selection style to every object added to the canvas
      canvas.on("object:added", (e: any) => {
        const obj = e.target;
        if (obj && !obj.__selectionStyled) {
          obj.set({ borderColor: "#00ff41", cornerColor: "#00ff41", cornerStrokeColor: "#00ff41", cornerSize: 10 });
          obj.__selectionStyled = true;
        }
        pushHistory();
      });

      fabricRef.current = { canvas, IText, FabricImage, Circle, Rect };

      // Cargar diseño base del admin si existe
      if (virola.disenoBase) {
        try {
          const json = JSON.parse(virola.disenoBase);
          canvas.loadFromJSON(json).then(() => {
            canvas.renderAll();
            setFabricLoaded(true);
            setTimeout(() => pushHistory(), 100);
          });
        } catch {
          setFabricLoaded(true);
          setTimeout(() => pushHistory(), 100);
        }
      } else {
        setFabricLoaded(true);
        setTimeout(() => pushHistory(), 100);
      }
    });
    return () => {
      cancelled = true;
      fabricRef.current?.canvas?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar color de fondo en el canvas cuando cambia bgColor
  useEffect(() => {
    const canvas = fabricRef.current?.canvas;
    if (!canvas) return;
    canvas.backgroundColor = bgColor;
    canvas.renderAll();
  }, [bgColor]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // ── Texto curvo en arco ────────────────────────────────────────────────────
  function renderArcText(text: string, radius: number, startAngleDeg: number, color: string, family: string, size: number) {
    const canvas = fabricRef.current?.canvas;
    if (!canvas || !text.trim()) return;

    // Render at 3× resolution to avoid pixelation
    const DPR = 3;
    const offscreen = document.createElement("canvas");
    offscreen.width = CANVAS_SIZE * DPR;
    offscreen.height = CANVAS_SIZE * DPR;
    const ctx = offscreen.getContext("2d")!;
    ctx.scale(DPR, DPR);
    ctx.font = `${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const chars = text.split("");
    const totalAngle = (chars.length - 1) * (size / radius) * 0.7;
    const startAngle = (startAngleDeg - 90) * (Math.PI / 180) - totalAngle / 2;

    chars.forEach((char, i) => {
      const angle = startAngle + i * (size / radius) * 0.7;
      ctx.save();
      ctx.translate(CANVAS_SIZE / 2 + radius * Math.cos(angle), CANVAS_SIZE / 2 + radius * Math.sin(angle));
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });

    // Tight crop: scan actual non-transparent pixels (in DPR space)
    const pad = 4;
    const W = CANVAS_SIZE * DPR;
    const H = CANVAS_SIZE * DPR;
    const imgData = ctx.getImageData(0, 0, W, H).data;
    let minX = W, minY = H, maxX = 0, maxY = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (imgData[(y * W + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(W - cropX, maxX - minX + pad * 2);
    const cropH = Math.min(H - cropY, maxY - minY + pad * 2);

    const cropped = document.createElement("canvas");
    cropped.width = cropW;
    cropped.height = cropH;
    cropped.getContext("2d")!.drawImage(offscreen, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // Center in original (1×) canvas coordinates
    const imgCenterX = (cropX + cropW / 2) / DPR;
    const imgCenterY = (cropY + cropH / 2) / DPR;

    import("fabric").then(({ FabricImage }) => {
      FabricImage.fromURL(cropped.toDataURL()).then((img: any) => {
        img.set({
          left: imgCenterX,
          top: imgCenterY,
          originX: "center",
          originY: "center",
          scaleX: 1 / DPR,
          scaleY: 1 / DPR,
          selectable: true,
          evented: true,
          borderColor: "#00ff41",
          cornerColor: "#00ff41",
          cornerStrokeColor: "#00ff41",
          cornerSize: 10,
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        setSelectedScale(1 / DPR);
        setSelectedAngle(0);
      });
    });
    setArcText("");
  }

  // ── Acciones del editor ────────────────────────────────────────────────────
  const addText = useCallback(() => {
    const { canvas, IText } = fabricRef.current ?? {};
    if (!canvas || !IText) return;
    const obj = new IText(textInput.trim() || "Tu texto", {
      left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2,
      originX: "center", originY: "center",
      fontSize, fontFamily, fill: textColor, editable: true,
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
      img.set({
        left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2, originX: "center", originY: "center",
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    };
    input.click();
  }, []);

  const applyTemplate = useCallback((tpl: typeof TEMPLATES[0]) => {
    const { canvas, IText } = fabricRef.current ?? {};
    if (!canvas || !IText) return;
    canvas.getObjects().forEach((o: any) => canvas.remove(o));
    tpl.build(IText, fontSize).forEach((obj: any) => canvas.add(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  }, [fontSize]);

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
    obj.dirty = true;
    canvas.requestRenderAll();
  }, []);

  // ── Preview 3D (mockup mate) ───────────────────────────────────────────────
  function buildPreview3D() {
    const { canvas, Circle } = fabricRef.current ?? {};
    if (!canvas || !previewRef.current) return;
    const pc = previewRef.current;
    const ctx = pc.getContext("2d")!;
    pc.width = 300; pc.height = 440;

    // Mate (cuerpo)
    ctx.fillStyle = "#5c3d1a";
    ctx.beginPath();
    ctx.roundRect(80, 100, 140, 280, [20, 20, 35, 35]);
    ctx.fill();

    // Boca del mate
    ctx.fillStyle = "#3d2810";
    ctx.beginPath();
    ctx.roundRect(90, 100, 120, 25, 5);
    ctx.fill();

    // Bombilla
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(150, 100);
    ctx.lineTo(200, 30);
    ctx.stroke();
    ctx.fillStyle = "#ccc";
    ctx.beginPath();
    ctx.ellipse(200, 28, 10, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Virola (como anillo sobre la bombilla)
    const vx = 195, vy = 75;
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = CANVAS_SIZE; tmpCanvas.height = CANVAS_SIZE;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origClip = canvas.clipPath;
    canvas.clipPath = undefined;
    canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
    canvas.clipPath = origClip;
    canvas.renderAll();

    const img = new Image();
    img.onload = () => {
      const s = 60 / CANVAS_SIZE;
      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate(-0.4);
      // Recorte circular
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, -CANVAS_SIZE * s / 2, -CANVAS_SIZE * s / 2, CANVAS_SIZE * s, CANVAS_SIZE * s);
      // Agujero
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(0, 0, 30 * (RING_INNER / RING_OUTER), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // Brillo
      ctx.beginPath();
      ctx.arc(-5, -8, 20, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(-5, -8, 2, -5, -8, 20);
      grd.addColorStop(0, "rgba(255,255,255,0.35)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.restore();
    };
    img.src = dataUrl;
    setShowPreview(true);
  }

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
    const origClip = canvas.clipPath;
    canvas.clipPath = undefined;
    canvas.renderAll();
    const preview = canvas.toDataURL({ format: "png", multiplier: 0.5 });
    const datos = canvas.toJSON();
    canvas.clipPath = origClip;
    canvas.renderAll();
    onAddToCart(preview, { ...datos, quantity });
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  }, [onAddToCart, quantity]);

  const FONTS = ["Georgia", "Arial", "Verdana", "Courier New", "Times New Roman", "Impact", "Palatino"];
  const perfilActual = perfiles.find(p => p.id === perfilId);

  const tabBtn = (id: typeof activeTab, label: string) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Panel izquierdo ─────────────────────────────────────────────────── */}
      <div className="lg:w-72 space-y-4 shrink-0">

        {/* Tabs de herramientas */}
        <div className="bg-gray-100 rounded-xl p-1 flex gap-1 flex-wrap">
          {tabBtn("templates", "Plantillas")}
          {tabBtn("text", "Texto")}
          {tabBtn("arc", "Texto arco")}
          {tabBtn("image", "Imagen")}
          {tabBtn("bg", "Fondo")}
        </div>

        {/* ── Plantillas ── */}
        {activeTab === "templates" && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <Layers size={14} /> Plantillas
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="border rounded-xl p-3 hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-center group"
                >
                  <div className="text-2xl mb-1">{tpl.thumb}</div>
                  <div className="text-xs text-gray-600 group-hover:text-emerald-700">{tpl.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">Las plantillas reemplazan el diseño actual.</p>
          </div>
        )}

        {/* ── Texto ── */}
        {activeTab === "text" && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <Type size={14} /> Texto
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
              <label className="text-xs text-gray-500 w-14">Tamaño</label>
              <input
                type="range" min="8" max="72" value={fontSize}
                onChange={(e) => { setFontSize(Number(e.target.value)); updateSelected("fontSize", Number(e.target.value)); }}
                className="flex-1"
              />
              <span className="text-xs w-6 text-right">{fontSize}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Color</label>
              <input
                type="color" value={textColor}
                onChange={(e) => { setTextColor(e.target.value); updateSelected("fill", e.target.value); }}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <span className="text-xs text-gray-400 font-mono">{textColor}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateSelected("fontWeight", "bold")} className="flex-1 border rounded-lg py-1.5 text-xs font-bold hover:bg-gray-50">N</button>
              <button onClick={() => updateSelected("fontStyle", "italic")} className="flex-1 border rounded-lg py-1.5 text-xs italic hover:bg-gray-50">K</button>
              <button onClick={() => updateSelected("underline", true)} className="flex-1 border rounded-lg py-1.5 text-xs underline hover:bg-gray-50">S</button>
            </div>
            <button
              onClick={addText}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-medium"
            >
              Agregar texto
            </button>
          </div>
        )}

        {/* ── Texto en arco ── */}
        {activeTab === "arc" && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <RefreshCw size={14} /> Texto en arco
            </h3>
            <input
              value={arcText}
              onChange={(e) => setArcText(e.target.value)}
              placeholder="Texto curvo..."
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Radio</label>
              <input
                type="range" min="90" max="200" value={arcRadius}
                onChange={(e) => setArcRadius(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs w-8 text-right">{arcRadius}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Rotación</label>
              <input
                type="range" min="-180" max="180" value={arcAngle}
                onChange={(e) => setArcAngle(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs w-8 text-right">{arcAngle}°</span>
            </div>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
            >
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Color</label>
              <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
            </div>
            <button
              onClick={() => renderArcText(arcText, arcRadius, arcAngle, textColor, fontFamily, fontSize)}
              disabled={!arcText.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-medium"
            >
              Agregar texto en arco
            </button>
            <p className="text-xs text-gray-400">El texto curvo se inserta como imagen editable.</p>
          </div>
        )}

        {/* ── Imagen ── */}
        {activeTab === "image" && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <ImageIcon size={14} /> Imagen / Logo
            </h3>
            <button
              onClick={addImage}
              className="w-full border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 py-6 rounded-xl text-sm transition-colors"
            >
              Subir desde dispositivo
            </button>
            <p className="text-xs text-gray-400">Soporta PNG, JPG, SVG. Se recorta al área de la virola.</p>
          </div>
        )}

        {/* ── Fondo / material ── */}
        {activeTab === "bg" && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Color de fondo</h3>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(MATERIAL_COLORS).map(([mat, col]) => (
                <button
                  key={mat}
                  onClick={() => setBgColor(col)}
                  title={mat}
                  className={`w-10 h-10 rounded-full border-4 transition-all ${bgColor === col ? "border-emerald-500 scale-110" : "border-transparent hover:border-gray-300"}`}
                  style={{ background: col }}
                />
              ))}
              {/* Blanco y negro */}
              {["#ffffff", "#1a1a1a", "#8B4513", "#2d6a4f"].map(col => (
                <button
                  key={col}
                  onClick={() => setBgColor(col)}
                  className={`w-10 h-10 rounded-full border-4 transition-all ${bgColor === col ? "border-emerald-500 scale-110" : "border-transparent hover:border-gray-300"}`}
                  style={{ background: col }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <label className="text-xs text-gray-500">Personalizado</label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <span className="text-xs text-gray-400 font-mono">{bgColor}</span>
            </div>
          </div>
        )}

        {/* Elemento seleccionado */}
        {selectedObj && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Elemento seleccionado</h3>

            {/* Tamaño */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Tamaño</label>
              <input
                type="range" min="0.05" max="5" step="0.05" value={selectedScale}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setSelectedScale(s);
                  const c = fabricRef.current?.canvas;
                  const obj = c?.getActiveObject();
                  if (obj) { obj.scale(s); c.renderAll(); }
                }}
                className="flex-1"
              />
              <span className="text-xs w-10 text-right font-mono">{Math.round(selectedScale * 100)}%</span>
            </div>

            {/* Rotación */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-14">Rotación</label>
              <input
                type="range" min="-180" max="180" step="1" value={selectedAngle}
                onChange={(e) => {
                  const a = Number(e.target.value);
                  setSelectedAngle(a);
                  const c = fabricRef.current?.canvas;
                  const obj = c?.getActiveObject();
                  if (obj) { obj.set("angle", a); c.renderAll(); }
                }}
                className="flex-1"
              />
              <span className="text-xs w-10 text-right font-mono">{selectedAngle}°</span>
            </div>

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
              <button
                onClick={() => { const c = fabricRef.current?.canvas; const a = c?.getActiveObject(); if (a) { c.bringObjectToFront(a); c.renderAll(); } }}
                className="flex items-center justify-center gap-1 border rounded-lg py-2 text-xs hover:bg-gray-50"
              >
                Al frente
              </button>
              <button
                onClick={() => { const c = fabricRef.current?.canvas; const a = c?.getActiveObject(); if (a) { c.sendObjectToBack(a); c.renderAll(); } }}
                className="flex items-center justify-center gap-1 border rounded-lg py-2 text-xs hover:bg-gray-50"
              >
                Al fondo
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

        {/* Perfil láser */}
        {perfiles.length > 0 && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Perfil de láser</h3>
            <select
              value={perfilId ?? ""}
              onChange={(e) => setPerfilId(Number(e.target.value))}
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
            >
              {perfiles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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

        {/* Exportar — solo admin */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border p-4 space-y-2">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-1">
              <Download size={14} /> Exportar
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExportPNG} disabled={!!exporting}
                className="flex items-center justify-center gap-1.5 border rounded-xl py-2 text-xs hover:bg-gray-50 disabled:opacity-50">
                <Download size={12} /> {exporting === "png" ? "..." : "PNG"}
              </button>
              <button onClick={handleExportSVG} disabled={!!exporting}
                className="flex items-center justify-center gap-1.5 border rounded-xl py-2 text-xs hover:bg-gray-50 disabled:opacity-50">
                <File size={12} /> {exporting === "svg" ? "..." : "SVG"}
              </button>
              <button onClick={handleExportDXF} disabled={!!exporting}
                className="flex items-center justify-center gap-1.5 border border-orange-200 text-orange-700 rounded-xl py-2 text-xs hover:bg-orange-50 disabled:opacity-50">
                <File size={12} /> {exporting === "dxf" ? "..." : "DXF Láser"}
              </button>
              <button onClick={handleExportPDF} disabled={!!exporting}
                className="flex items-center justify-center gap-1.5 border border-blue-200 text-blue-700 rounded-xl py-2 text-xs hover:bg-blue-50 disabled:opacity-50">
                <FileText size={12} /> {exporting === "pdf" ? "..." : "PDF Orden"}
              </button>
            </div>
          </div>
        )}

        {/* Cantidad y carrito */}
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Cantidad</span>
            <div className="flex items-center gap-2 border rounded-xl">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-2.5 py-1.5 hover:bg-gray-50 rounded-l-xl"><Minus size={12} /></button>
              <span className="text-sm w-6 text-center font-medium">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="px-2.5 py-1.5 hover:bg-gray-50 rounded-r-xl"><Plus size={12} /></button>
            </div>
          </div>
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">Total</span>
            <span className="font-bold">${(Number(virola.precioBase) * quantity).toLocaleString("es-AR")}</span>
          </div>
          <button
            onClick={handleAddToCart}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              added ? "bg-emerald-100 text-emerald-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            <ShoppingCart size={16} />
            {added ? "¡Agregado!" : "Agregar al carrito"}
          </button>
          <button onClick={clearCanvas} className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 text-xs py-1">
            <RotateCcw size={12} /> Limpiar diseño
          </button>
        </div>
      </div>

      {/* ── Canvas + controles ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center gap-4">

        {/* Barra de herramientas superior */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={undo} disabled={!canUndo}
              title="Deshacer (Ctrl+Z)"
              className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={redo} disabled={!canRedo}
              title="Rehacer (Ctrl+Y)"
              className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <Redo2 size={15} />
            </button>
          </div>
          <button
            onClick={buildPreview3D}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl text-sm font-medium transition-colors"
          >
            <Eye size={15} /> Vista previa 3D
          </button>
        </div>

        {/* Canvas principal */}
        <div className="bg-gray-50 rounded-2xl border w-full flex items-center justify-center min-h-[540px] relative overflow-hidden">
          {!fabricLoaded && (
            <div className="text-gray-400 text-sm">Cargando editor...</div>
          )}
          <div style={{ display: fabricLoaded ? "block" : "none" }}>
            <canvas ref={canvasRef} className="rounded-full" />
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-5 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-gray-400" />
            Borde exterior ({virola.diametroMm}mm)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-gray-400" />
            Orificio central
          </span>
        </div>
      </div>

      {/* ── Modal vista previa 3D ────────────────────────────────────────────── */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 mb-4">Vista previa en mate</h3>
            <canvas ref={previewRef} className="mx-auto rounded-xl border" style={{ width: 200, height: 293 }} />
            <p className="text-xs text-gray-400 mt-3">Representación ilustrativa del diseño en el producto</p>
            <button
              onClick={() => setShowPreview(false)}
              className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
