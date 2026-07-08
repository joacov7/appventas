"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Wand2, Upload, Download, RotateCw, Sun, Type, Images, Trash2, Plus } from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";

type Modo = "grabado" | "color";
interface Modelo { id: number; nombre: string; categoria: string; imagen_url: string }
const CATEGORIAS = ["mate", "matera", "termo", "cuchillo", "tabla", "llavero", "otro"];

// Estudio de mockup: subís la foto del producto y el logo del cliente, lo
// posicionás/escalás, y descargás la vista previa para enviarla. Sin IA.
export default function PersonalizadosPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);

  // Transformación del logo (posición relativa 0..1 respecto al canvas)
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [escala, setEscala] = useState(0.3);   // ancho del logo relativo al canvas
  const [rot, setRot] = useState(0);
  const [opacidad, setOpacidad] = useState(1);
  const [modo, setModo] = useState<Modo>("grabado");
  const [tab, setTab] = useState<"mockup" | "modelos">("mockup");
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [nuevoModelo, setNuevoModelo] = useState<{ nombre: string; categoria: string; imagen_url: string }>({ nombre: "", categoria: "mate", imagen_url: "" });

  async function cargarModelos() {
    const r = await fetch("/api/personalizados/modelos");
    if (r.ok) setModelos(await r.json());
  }
  useEffect(() => { cargarModelos(); }, []);

  // Carga una imagen base desde una URL (Cloudinary permite CORS para el canvas).
  function cargarBaseDesdeUrl(url: string) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBaseImg(img);
    img.src = url;
  }

  async function guardarModelo() {
    if (!nuevoModelo.nombre.trim() || !nuevoModelo.imagen_url) return;
    const r = await fetch("/api/personalizados/modelos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevoModelo),
    });
    if (r.ok) { setNuevoModelo({ nombre: "", categoria: "mate", imagen_url: "" }); await cargarModelos(); }
  }
  async function eliminarModelo(id: number) {
    if (!confirm("¿Eliminar este modelo?")) return;
    await fetch(`/api/personalizados/modelos?id=${id}`, { method: "DELETE" });
    await cargarModelos();
  }
  const [tono, setTono] = useState("#3b2a1a"); // color del grabado (tono quemado)

  const drag = useRef<{ activo: boolean }>({ activo: false });

  function cargarImagen(file: File, setter: (img: HTMLImageElement) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setter(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // Dibuja todo en el canvas.
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Tamaño del canvas según la foto del producto (o un lienzo por defecto)
    const W = 900;
    const H = baseImg ? Math.round((baseImg.height / baseImg.width) * W) : 600;
    canvas.width = W; canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    if (baseImg) ctx.drawImage(baseImg, 0, 0, W, H);
    else { ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, 0, W, H); }

    if (logoImg) {
      const logoW = escala * W;
      const logoH = (logoImg.height / logoImg.width) * logoW;
      const cx = pos.x * W, cy = pos.y * H;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.globalAlpha = opacidad;

      if (modo === "grabado") {
        // Look grabado: silueta del logo teñida en un solo tono quemado.
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.round(logoW));
        off.height = Math.max(1, Math.round(logoH));
        const octx = off.getContext("2d")!;
        octx.drawImage(logoImg, 0, 0, off.width, off.height);
        octx.globalCompositeOperation = "source-atop";
        octx.fillStyle = tono;
        octx.fillRect(0, 0, off.width, off.height);
        ctx.drawImage(off, -logoW / 2, -logoH / 2, logoW, logoH);
      } else {
        ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH);
      }
      ctx.restore();
    }
  }, [baseImg, logoImg, pos, escala, rot, opacidad, modo, tono]);

  useEffect(() => { render(); }, [render]);

  // Arrastrar el logo con el mouse/dedo.
  function posDesdeEvento(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }
  function onDown(e: React.PointerEvent) { if (logoImg) { drag.current.activo = true; setPos(posDesdeEvento(e)); } }
  function onMove(e: React.PointerEvent) { if (drag.current.activo) setPos(posDesdeEvento(e)); }
  function onUp() { drag.current.activo = false; }

  function descargar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "mockup-personalizado.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Wand2 className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Personalizados</h1>
          <p className="text-sm text-gray-500">Mostrale a la empresa su logo sobre el producto. Ideal para cerrar ventas B2B.</p>
        </div>
      </div>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {([["mockup", "Mockup"], ["modelos", "Modelos"]] as [typeof tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "modelos" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <p className="font-medium text-gray-900 text-sm">Cargar un modelo nuevo</p>
            <p className="text-xs text-gray-500">Subí una foto del producto (fondo blanco, mostrando la cara donde va el logo). Después queda disponible para elegir en el Mockup.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Nombre del modelo</label>
                <input value={nuevoModelo.nombre} onChange={e => setNuevoModelo({ ...nuevoModelo, nombre: e.target.value })}
                  placeholder="Ej: Mate imperial forrado" className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Categoría</label>
                <select value={nuevoModelo.categoria} onChange={e => setNuevoModelo({ ...nuevoModelo, categoria: e.target.value })}
                  className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none bg-white capitalize">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <MediaUpload urls={nuevoModelo.imagen_url ? [nuevoModelo.imagen_url] : []}
              onChange={(urls) => setNuevoModelo({ ...nuevoModelo, imagen_url: urls[urls.length - 1] ?? "" })} />
            <div className="flex justify-end">
              <button onClick={guardarModelo} disabled={!nuevoModelo.nombre.trim() || !nuevoModelo.imagen_url}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
                <Plus size={16} /> Guardar modelo
              </button>
            </div>
          </div>

          {modelos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
              <Images className="mx-auto text-gray-300 mb-3" size={32} />
              <p className="text-gray-500 text-sm">Todavía no cargaste modelos. Subí las fotos de tus mates, materas, termos, cuchillos y tablas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {modelos.map(m => (
                <div key={m.id} className="bg-white rounded-xl border overflow-hidden group relative">
                  <img src={m.imagen_url} alt={m.nombre} className="w-full h-32 object-cover" />
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate">{m.nombre}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{m.categoria}</p>
                  </div>
                  <button onClick={() => eliminarModelo(m.id)}
                    className="absolute top-1.5 right-1.5 bg-white/90 rounded-lg p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "mockup" && (
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Lienzo */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <canvas ref={canvasRef}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
              className="w-full rounded-xl border cursor-move touch-none bg-gray-50" />
            <p className="text-xs text-gray-400 mt-2 text-center">Tocá y arrastrá sobre la imagen para mover el logo.</p>
          </div>
        </div>

        {/* Controles */}
        <div className="space-y-4">
          {modelos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <label className="text-xs text-gray-500">Elegí un modelo</label>
              <div className="flex gap-2 overflow-x-auto mt-2 pb-1">
                {modelos.map(m => (
                  <button key={m.id} onClick={() => cargarBaseDesdeUrl(m.imagen_url)} title={m.nombre}
                    className="shrink-0 w-16 h-16 rounded-lg border overflow-hidden hover:ring-2 hover:ring-indigo-500">
                    <img src={m.imagen_url} alt={m.nombre} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <FileBtn label={modelos.length ? "…o subí otra foto" : "1. Foto del producto"} onFile={f => cargarImagen(f, setBaseImg)} listo={!!baseImg} />
            <FileBtn label="Logo del cliente (PNG)" onFile={f => cargarImagen(f, setLogoImg)} listo={!!logoImg} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-500">Técnica</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {([["grabado", "Grabado láser"], ["color", "Vinilo (color)"]] as [Modo, string][]).map(([m, l]) => (
                  <button key={m} onClick={() => setModo(m)}
                    className={`text-sm py-2 rounded-lg border ${modo === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {modo === "grabado" && (
              <div className="flex items-center gap-2">
                <Sun size={14} className="text-gray-400" />
                <label className="text-xs text-gray-500 flex-1">Tono del grabado</label>
                <input type="color" value={tono} onChange={e => setTono(e.target.value)} className="w-8 h-8 rounded border" />
              </div>
            )}

            <Slider icon={<Type size={13} />} label="Tamaño" value={escala} min={0.05} max={0.9} step={0.01} onChange={setEscala} />
            <Slider icon={<RotateCw size={13} />} label="Rotación" value={rot} min={-180} max={180} step={1} onChange={setRot} fmt={v => `${v}°`} />
            <Slider icon={<Sun size={13} />} label="Opacidad" value={opacidad} min={0.1} max={1} step={0.05} onChange={setOpacidad} fmt={v => `${Math.round(v * 100)}%`} />
          </div>

          <button onClick={descargar} disabled={!baseImg}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-3 rounded-xl">
            <Download size={16} /> Descargar mockup
          </button>
          <p className="text-xs text-gray-400 text-center">Descargalo y mandáselo al cliente por WhatsApp o email.</p>
        </div>
      </div>
      )}
    </div>
  );
}

function FileBtn({ label, onFile, listo }: { label: string; onFile: (f: File) => void; listo: boolean }) {
  return (
    <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl px-3 py-2.5 cursor-pointer text-sm ${listo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
      <Upload size={15} /> {listo ? `✓ ${label}` : label}
      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

function Slider({ icon, label, value, min, max, step, onChange, fmt }: {
  icon: React.ReactNode; label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span className="flex items-center gap-1">{icon} {label}</span>
        <span>{fmt ? fmt(value) : Math.round(value * 100) + "%"}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-full accent-indigo-600" />
    </div>
  );
}
