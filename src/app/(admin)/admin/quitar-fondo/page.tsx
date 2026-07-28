"use client";

import { useState, useRef } from "react";
import { Eraser, Upload, Download, RefreshCw } from "lucide-react";

export default function QuitarFondoPage() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultadoUrl, setResultadoUrl] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState("");
  const [transparente, setTransparente] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function elegir(f: File) {
    setArchivo(f);
    setOriginalUrl(URL.createObjectURL(f));
    setResultadoUrl(null);
    setError("");
  }

  async function procesar() {
    if (!archivo) return;
    setProcesando(true); setError(""); setResultadoUrl(null); setProgreso("Cargando modelo…");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const sinFondo = await removeBackground(archivo, {
        progress: (key: string, current: number, total: number) => {
          const pct = total ? Math.round((current / total) * 100) : 0;
          setProgreso(key.includes("fetch") ? `Descargando modelo… ${pct}%` : `Procesando… ${pct}%`);
        },
      });

      // Componemos sobre fondo blanco (o dejamos transparente).
      const img = await blobAImagen(sinFondo);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      if (!transparente) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0);
      setResultadoUrl(canvas.toDataURL("image/png"));
      setProgreso("");
    } catch (e: any) {
      console.error("[quitar-fondo]", e);
      const detalle = e?.message || String(e) || "error desconocido";
      setError(`No se pudo procesar: ${detalle}`);
    } finally {
      setProcesando(false);
    }
  }

  function descargar() {
    if (!resultadoUrl) return;
    const a = document.createElement("a");
    a.download = `sin-fondo-${Date.now()}.png`;
    a.href = resultadoUrl;
    a.click();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Eraser className="text-fuchsia-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quitar fondo</h1>
          <p className="text-sm text-gray-500">Subí una foto y te la devolvemos con fondo blanco (o transparente). Se procesa en tu navegador, sin costo.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && elegir(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 border-2 border-dashed border-gray-200 hover:bg-gray-50 text-gray-600 text-sm px-4 py-2.5 rounded-xl">
          <Upload size={16} /> {archivo ? "Elegir otra foto" : "Subir foto"}
        </button>
        <label className="text-sm text-gray-600 flex items-center gap-1.5">
          <input type="checkbox" checked={transparente} onChange={e => setTransparente(e.target.checked)} className="accent-fuchsia-600" />
          Fondo transparente (en vez de blanco)
        </label>
        <button onClick={procesar} disabled={!archivo || procesando}
          className="ml-auto flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl">
          {procesando ? <RefreshCw size={16} className="animate-spin" /> : <Eraser size={16} />}
          {procesando ? "Procesando…" : "Quitar fondo"}
        </button>
      </div>

      {procesando && progreso && <p className="text-sm text-gray-500">{progreso} <span className="text-xs text-gray-400">(la primera vez descarga el modelo, puede tardar)</span></p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {(originalUrl || resultadoUrl) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {originalUrl && (
            <div className="bg-white rounded-2xl border border-gray-100 p-3">
              <p className="text-xs text-gray-400 mb-2">Original</p>
              <img src={originalUrl} alt="original" className="w-full rounded-xl" />
            </div>
          )}
          {resultadoUrl && (
            <div className="bg-white rounded-2xl border border-gray-100 p-3">
              <p className="text-xs text-gray-400 mb-2">Resultado</p>
              <img src={resultadoUrl} alt="resultado"
                className="w-full rounded-xl" style={transparente ? { backgroundImage: "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%)", backgroundSize: "20px 20px" } : undefined} />
              <button onClick={descargar}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl">
                <Download size={16} /> Descargar PNG
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function blobAImagen(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
