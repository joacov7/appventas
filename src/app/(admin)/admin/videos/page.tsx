"use client";

import { useState } from "react";
import { Film, Sparkles, Download, Copy, Check, RefreshCw } from "lucide-react";
import { ProductoPickerML } from "@/components/admin/ProductoPickerML";

interface Prod { id: string; name: string; price: number | null; imagenes: string[] }

const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

export default function VideosPage() {
  const [prod, setProd] = useState<Prod | null>(null);
  const [imgs, setImgs] = useState<HTMLImageElement[]>([]);
  const [cargandoImgs, setCargandoImgs] = useState(false);
  const [segundos, setSegundos] = useState(2.5);
  const [mostrarPrecio, setMostrarPrecio] = useState(true);

  const [hook, setHook] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [generandoCopy, setGenerandoCopy] = useState(false);

  const [generandoVideo, setGenerandoVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ext, setExt] = useState("mp4");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState("");

  async function elegirProducto(p: { id: string; name: string }) {
    setError(""); setVideoUrl(null); setImgs([]);
    setCargandoImgs(true);
    try {
      const d = await fetch(`/api/productos/${p.id}`).then(r => r.json());
      const imagenes: string[] = Array.isArray(d.imageUrls) ? d.imageUrls : [];
      const price = d.variants?.[0]?.price != null ? Number(d.variants[0].price) : null;
      const info: Prod = { id: p.id, name: d.name ?? p.name, price, imagenes };
      setProd(info);
      setHook(info.name);
      const cargadas = await cargarImagenes(imagenes);
      setImgs(cargadas);
      if (!cargadas.length) setError("Este producto no tiene fotos cargadas. Subile fotos primero.");
    } catch { setError("No se pudo cargar el producto."); }
    setCargandoImgs(false);
  }

  async function generarCopy() {
    if (!prod) return;
    setGenerandoCopy(true); setError("");
    const r = await fetch("/api/reels/copy", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: prod.name, precio: prod.price }),
    });
    setGenerandoCopy(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setHook(d.hook || prod.name); setCaption(d.caption || ""); setHashtags(d.hashtags || []); }
    else setError(d.error ?? "No se pudo generar el texto");
  }

  async function generarVideo() {
    if (!imgs.length) return;
    setGenerandoVideo(true); setVideoUrl(null); setError(""); setProgreso(0);
    try {
      const W = 1080, H = 1920, fps = 30;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(fps);
      const mime = elegirMime();
      const rec = new MediaRecorder(stream, { mimeType: mime.type, videoBitsPerSecond: 9_000_000 });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: mime.type })); });
      rec.start();

      const secs = segundos;
      const fade = 0.4;
      const total = secs * imgs.length;
      const t0 = performance.now();
      await new Promise<void>(resolve => {
        function frame() {
          const t = (performance.now() - t0) / 1000;
          if (t >= total) { resolve(); return; }
          setProgreso(Math.min(99, Math.round((t / total) * 100)));
          dibujarFrame(ctx, W, H, imgs, t, secs, fade, { hook, name: prod?.name ?? "", price: mostrarPrecio ? prod?.price ?? null : null });
          requestAnimationFrame(frame);
        }
        frame();
      });
      rec.stop();
      const blob = await done;
      setVideoUrl(URL.createObjectURL(blob));
      setExt(mime.ext);
      setProgreso(100);
    } catch (e) {
      console.error(e);
      setError("No se pudo generar el video en este navegador. Probá con Chrome en la compu.");
    }
    setGenerandoVideo(false);
  }

  function descargar() {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.download = `reel-${(prod?.name ?? "video").replace(/\s+/g, "-").toLowerCase()}.${ext}`;
    a.href = videoUrl; a.click();
  }

  function copiar(texto: string, clave: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(clave); setTimeout(() => setCopiado(""), 1500);
  }

  const captionCompleta = [caption, hashtags.map(h => `#${h}`).join(" ")].filter(Boolean).join("\n\n");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Film className="text-fuchsia-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Videos para redes</h1>
          <p className="text-sm text-gray-500">Armá un Reel vertical (9:16) con las fotos del producto y un copy con IA. Sin audio (le ponés el sonido de moda al subirlo).</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="text-xs text-gray-500">Elegí el producto</label>
          <div className="mt-1"><ProductoPickerML onSelect={p => elegirProducto(p as any)} /></div>
        </div>

        {cargandoImgs && <p className="text-sm text-gray-400">Cargando fotos…</p>}

        {prod && imgs.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-500">{imgs.length} foto(s) · {prod.name}{prod.price ? ` · ${money(prod.price)}` : ""}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-xs text-gray-600 flex items-center gap-2">
                Segundos por foto
                <input type="range" min={1.5} max={4} step={0.5} value={segundos} onChange={e => setSegundos(Number(e.target.value))} className="accent-fuchsia-600" />
                <b>{segundos}s</b>
              </label>
              <label className="text-xs text-gray-600 flex items-center gap-1.5">
                <input type="checkbox" checked={mostrarPrecio} onChange={e => setMostrarPrecio(e.target.checked)} className="accent-fuchsia-600" />
                Mostrar precio
              </label>
              <span className="text-xs text-gray-400">Duración total: ~{Math.round(segundos * imgs.length)}s</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={generarVideo} disabled={generandoVideo}
                className="flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
                {generandoVideo ? <RefreshCw size={16} className="animate-spin" /> : <Film size={16} />}
                {generandoVideo ? `Generando… ${progreso}%` : "Generar video"}
              </button>
              <button onClick={generarCopy} disabled={generandoCopy}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl">
                <Sparkles size={16} className="text-fuchsia-500" /> {generandoCopy ? "Generando…" : "Generar copy con IA"}
              </button>
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {videoUrl && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row gap-4">
          <video src={videoUrl} controls playsInline className="w-48 rounded-xl bg-black mx-auto" style={{ aspectRatio: "9/16" }} />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-gray-800">¡Video listo!</p>
            <button onClick={descargar} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-medium px-4 py-2 rounded-xl">
              <Download size={16} /> Descargar {ext.toUpperCase()}
            </button>
            {ext !== "mp4" && <p className="text-xs text-amber-600">Tu navegador exportó en {ext.toUpperCase()}. Para Instagram/TikTok conviene MP4: probá desde <b>Chrome</b> o subilo tal cual desde el celular.</p>}
            <p className="text-xs text-gray-400">Descargalo al celular y subilo a Reels/TikTok. Ahí le ponés el audio de moda.</p>
          </div>
        </div>
      )}

      {(caption || hashtags.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">Texto del posteo</p>
            <button onClick={() => copiar(captionCompleta, "cap")} className="flex items-center gap-1 text-xs text-fuchsia-600 hover:text-fuchsia-800">
              {copiado === "cap" ? <Check size={14} /> : <Copy size={14} />} Copiar todo
            </button>
          </div>
          {caption && <p className="text-sm text-gray-700 whitespace-pre-wrap">{caption}</p>}
          {hashtags.length > 0 && <p className="text-sm text-fuchsia-600">{hashtags.map(h => `#${h}`).join(" ")}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Helpers de render ────────────────────────────────────────────────────────
function elegirMime(): { type: string; ext: string } {
  const cand: [string, string][] = [
    ["video/mp4;codecs=avc1", "mp4"], ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"], ["video/webm;codecs=vp8", "webm"], ["video/webm", "webm"],
  ];
  for (const [type, ext] of cand) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return { type, ext };
  }
  return { type: "video/webm", ext: "webm" };
}

async function cargarImagenes(urls: string[]): Promise<HTMLImageElement[]> {
  const out: HTMLImageElement[] = [];
  for (const u of urls) {
    try {
      const res = await fetch(`/api/imagen-proxy?url=${encodeURIComponent(u)}`);
      if (!res.ok) continue;
      const blob = await res.blob();
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = URL.createObjectURL(blob);
      });
      out.push(img);
    } catch { /* saltar */ }
  }
  return out;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, alpha: number, zoom: number) {
  const iw = img.naturalWidth * zoom, ih = img.naturalHeight * zoom;
  const scale = Math.max(W / iw, H / ih);
  const w = iw * scale, h = ih * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

function textoAjustado(ctx: CanvasRenderingContext2D, texto: string, maxW: number): string[] {
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const test = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(test).width > maxW && actual) { lineas.push(actual); actual = p; }
    else actual = test;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function dibujarFrame(
  ctx: CanvasRenderingContext2D, W: number, H: number, imgs: HTMLImageElement[],
  t: number, secs: number, fade: number,
  overlay: { hook: string; name: string; price: number | null }
) {
  const idx = Math.min(imgs.length - 1, Math.floor(t / secs));
  const local = t - idx * secs;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Ligero zoom (Ken Burns) sobre la foto actual.
  const zoom = 1.04 + 0.06 * (local / secs);
  drawCover(ctx, imgs[idx], W, H, 1, zoom);
  // Crossfade con la siguiente.
  if (idx < imgs.length - 1 && local > secs - fade) {
    const a = (local - (secs - fade)) / fade;
    drawCover(ctx, imgs[idx + 1], W, H, a, 1.04);
  }

  // Degradé inferior para legibilidad.
  const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 12;

  // Hook (solo en la primera foto, con leve fade in/out).
  if (idx === 0 && overlay.hook) {
    const fadeIn = Math.min(1, local / 0.4);
    const fadeOut = Math.min(1, (secs - local) / 0.4);
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    ctx.fillStyle = "#fff";
    ctx.font = "800 76px Arial";
    const lineas = textoAjustado(ctx, overlay.hook, W - 140).slice(0, 3);
    lineas.forEach((l, i) => ctx.fillText(l, 70, 220 + i * 92));
    ctx.globalAlpha = 1;
  }

  // Nombre + precio abajo.
  ctx.fillStyle = "#fff";
  ctx.font = "800 60px Arial";
  const nombreLineas = textoAjustado(ctx, overlay.name, W - 140).slice(0, 2);
  const baseY = H - 200 - (nombreLineas.length - 1) * 70;
  nombreLineas.forEach((l, i) => ctx.fillText(l, 70, baseY + i * 70));
  if (overlay.price != null) {
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 84px Arial";
    ctx.fillText(new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(overlay.price), 70, H - 110);
  }
  ctx.shadowBlur = 0;
}
