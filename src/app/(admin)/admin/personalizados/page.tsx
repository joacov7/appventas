"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Wand2, Upload, Download, RotateCw, Sun, Type } from "lucide-react";

type Modo = "grabado" | "color";

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
          <h1 className="text-xl font-bold text-gray-900">Mockup de personalizados</h1>
          <p className="text-sm text-gray-500">Mostrale a la empresa su logo sobre el producto. Ideal para cerrar ventas B2B.</p>
        </div>
      </div>

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
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <FileBtn label="1. Foto del producto" onFile={f => cargarImagen(f, setBaseImg)} listo={!!baseImg} />
            <FileBtn label="2. Logo del cliente (PNG)" onFile={f => cargarImagen(f, setLogoImg)} listo={!!logoImg} />
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
