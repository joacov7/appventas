"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, Zap, Layers, CircleDot } from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";
import dynamic from "next/dynamic";
import type { VirolaCanvasHandle } from "@/components/store/VirolaCanvasCore";

const VirolaCanvasCore = dynamic(
  () => import("@/components/store/VirolaCanvasCore").then(m => ({ default: m.VirolaCanvasCore })),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Cargando editor...</div> }
);

const MATERIAL_COLORS: Record<string, string> = {
  "madera": "#c8a97a",
  "acero inoxidable": "#d0d0d0",
  "alpaca": "#b8c0c8",
  "cobre": "#b87333",
  "latón": "#c5a028",
};

interface Virola {
  id: number; nombre: string; slug: string; descripcion: string | null;
  material: string; diametroMm: number; precioBase: string;
  imageUrl: string | null; disenoBase: string | null; activa: boolean; posicion: number;
}
interface PerfilLaser {
  id: number; nombre: string; material: string; potencia: number;
  velocidad: number; pasadas: number; notas: string | null; activo: boolean;
}
const EMPTY_VIROLA = {
  nombre: "", slug: "", descripcion: "", material: "madera",
  diametroMm: 35, precioBase: "", imageUrl: null as string | null, disenoBase: null as string | null,
};
const EMPTY_PERFIL = { nombre: "", material: "todos", potencia: 80, velocidad: 100, pasadas: 1, notas: "" };
const MATERIALES = ["todos", "madera", "acero inoxidable", "alpaca", "cobre", "latón"];

function CanvasToolbar({ canvasRef }: { canvasRef: React.RefObject<VirolaCanvasHandle | null> }) {
  const [textInput, setTextInput] = useState("");
  const [fontSize, setFontSize] = useState(28);
  const [color, setColor] = useState("#1a1a1a");
  const addText = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas(); if (!canvas) return;
    import("fabric").then(({ IText }) => {
      const obj = new IText(textInput.trim() || "Texto base", { left: 250, top: 250, originX: "center", originY: "center", fontSize, fontFamily: "Georgia", fill: color, editable: true });
      canvas.add(obj); canvas.setActiveObject(obj); canvas.renderAll(); setTextInput("");
    });
  }, [canvasRef, textInput, fontSize, color]);
  const addImage = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas(); if (!canvas) return;
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      const url = URL.createObjectURL(file);
      const { FabricImage } = await import("fabric");
      const img = await FabricImage.fromURL(url);
      const scale = Math.min(300 / (img.width ?? 1), 300 / (img.height ?? 1));
      img.scale(scale); img.set({ left: 250, top: 250, originX: "center", originY: "center" });
      canvas.add(img); canvas.setActiveObject(img); canvas.renderAll();
    };
    input.click();
  }, [canvasRef]);
  const clearAll = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas || !confirm("¿Limpiar el diseño base?")) return;
    canvas.getObjects().forEach((o: any) => canvas.remove(o)); canvas.renderAll();
  }, [canvasRef]);
  const delSelected = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas();
    const obj = canvas?.getActiveObject();
    if (obj) { canvas.remove(obj); canvas.renderAll(); }
  }, [canvasRef]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addText()}
          placeholder="Texto del diseño base..." className="flex-1 border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-14">Tamaño</label>
        <input type="range" min="8" max="72" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="flex-1" />
        <span className="text-xs w-6">{fontSize}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={addText} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-medium">+ Texto</button>
        <button onClick={addImage} className="flex-1 border hover:bg-gray-50 py-2 rounded-xl text-sm">+ Imagen</button>
        <button onClick={delSelected} className="border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-sm"><Trash2 size={14} /></button>
        <button onClick={clearAll} className="border text-gray-500 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm"><X size={14} /></button>
      </div>
      <p className="text-xs text-gray-400">Este diseño se cargará precargado cuando el cliente personalice esta virola.</p>
    </div>
  );
}

export default function VirolasAdminPage() {
  const [tab, setTab] = useState<"virolas" | "perfiles">("virolas");
  const canvasRef = useRef<VirolaCanvasHandle>(null);
  const [virolas, setVirolas] = useState<Virola[]>([]);
  const [vLoading, setVLoading] = useState(true);
  const [showVForm, setShowVForm] = useState(false);
  const [editingV, setEditingV] = useState<Virola | null>(null);
  const [vForm, setVForm] = useState(EMPTY_VIROLA);
  const [vSaving, setVSaving] = useState(false);
  const [vError, setVError] = useState("");
  const [canvasReady, setCanvasReady] = useState(false);
  const [perfiles, setPerfiles] = useState<PerfilLaser[]>([]);
  const [pLoading, setPLoading] = useState(true);
  const [showPForm, setShowPForm] = useState(false);
  const [editingP, setEditingP] = useState<PerfilLaser | null>(null);
  const [pForm, setPForm] = useState(EMPTY_PERFIL);
  const [pSaving, setPSaving] = useState(false);
  const [pError, setPError] = useState("");

  async function loadVirolas() { const res = await fetch("/api/virolas"); if (res.ok) setVirolas(await res.json()); setVLoading(false); }
  async function loadPerfiles() { const res = await fetch("/api/virolas/perfiles"); if (res.ok) setPerfiles(await res.json()); setPLoading(false); }
  useEffect(() => { loadVirolas(); loadPerfiles(); }, []);

  useEffect(() => {
    if (!canvasReady || !showVForm || !editingV?.disenoBase) return;
    try { canvasRef.current?.loadJSON(JSON.parse(editingV.disenoBase)); } catch {}
  }, [canvasReady, showVForm, editingV]);

  function autoSlug(n: string) { return n.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

  async function saveVirola() {
    if (!vForm.nombre.trim() || !vForm.precioBase) { setVError("Nombre y precio requeridos"); return; }
    setVSaving(true); setVError("");
    try {
      const slug = vForm.slug.trim() || autoSlug(vForm.nombre);
      const disenoBase = canvasRef.current ? JSON.stringify(canvasRef.current.toJSON()) : null;
      const url = editingV ? `/api/virolas/${editingV.id}` : "/api/virolas";
      const res = await fetch(url, { method: editingV ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...vForm, slug, disenoBase }) });
      if (!res.ok) { setVError((await res.json()).error ?? "Error"); return; }
      setShowVForm(false); setCanvasReady(false); loadVirolas();
    } finally { setVSaving(false); }
  }
  async function toggleVirola(v: Virola) {
    await fetch(`/api/virolas/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activa: !v.activa }) });
    loadVirolas();
  }
  async function delVirola(v: Virola) {
    if (!confirm(`¿Eliminar "${v.nombre}"?`)) return;
    await fetch(`/api/virolas/${v.id}`, { method: "DELETE" }); loadVirolas();
  }
  async function savePerfil() {
    if (!pForm.nombre.trim()) { setPError("Nombre requerido"); return; }
    setPSaving(true); setPError("");
    try {
      const url = editingP ? `/api/virolas/perfiles/${editingP.id}` : "/api/virolas/perfiles";
      const res = await fetch(url, { method: editingP ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pForm) });
      if (!res.ok) { setPError((await res.json()).error ?? "Error"); return; }
      setShowPForm(false); loadPerfiles();
    } finally { setPSaving(false); }
  }
  async function delPerfil(p: PerfilLaser) {
    if (!confirm(`¿Eliminar perfil "${p.nombre}"?`)) return;
    await fetch(`/api/virolas/perfiles/${p.id}`, { method: "DELETE" }); loadPerfiles();
  }

  const bgColor = MATERIAL_COLORS[vForm.material] ?? "#e8dcc8";

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Virolas</h1>
        <p className="text-sm text-gray-500 mt-1">Catálogo, diseños base y perfiles de láser</p>
      </div>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[{ key:"virolas",label:"Modelos"},{key:"perfiles",label:"Perfiles de láser"}].map(({key,label})=>(
          <button key={key} onClick={()=>setTab(key as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab===key?"bg-white shadow text-gray-900":"text-gray-500 hover:text-gray-700"}`}>{label}</button>
        ))}
      </div>

      {tab === "virolas" && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={()=>{setEditingV(null);setVForm(EMPTY_VIROLA);setShowVForm(true);setVError("");setCanvasReady(false);}}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={16}/> Nueva virola
            </button>
          </div>

          {showVForm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
                <div className="flex items-center justify-between p-5 border-b">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <CircleDot size={18} className="text-emerald-600"/>
                    {editingV ? "Editar virola" : "Nueva virola"}
                  </h2>
                  <button onClick={()=>{setShowVForm(false);setCanvasReady(false);}} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-700 text-xs uppercase tracking-wide">Datos del modelo</h3>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Nombre *</label>
                      <input value={vForm.nombre} onChange={e=>setVForm(f=>({...f,nombre:e.target.value,slug:autoSlug(e.target.value)}))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ej: Virola Clásica 35mm"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Slug</label>
                        <input value={vForm.slug} onChange={e=>setVForm(f=>({...f,slug:e.target.value}))}
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"/>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Precio base *</label>
                        <input type="number" value={vForm.precioBase} onChange={e=>setVForm(f=>({...f,precioBase:e.target.value}))}
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="2500"/>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Material</label>
                        <select value={vForm.material} onChange={e=>setVForm(f=>({...f,material:e.target.value}))}
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                          {["madera","acero inoxidable","alpaca","cobre","latón"].map(m=><option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Diámetro (mm)</label>
                        <input type="number" value={vForm.diametroMm} onChange={e=>setVForm(f=>({...f,diametroMm:Number(e.target.value)}))}
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"/>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Descripción</label>
                      <textarea value={vForm.descripcion??""} onChange={e=>setVForm(f=>({...f,descripcion:e.target.value}))}
                        rows={2} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"/>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Imagen de portada</label>
                      <MediaUpload urls={vForm.imageUrl?[vForm.imageUrl]:[]} onChange={urls=>setVForm(f=>({...f,imageUrl:urls[urls.length-1]??null}))}/>
                    </div>
                    {vError && <p className="text-sm text-red-600">{vError}</p>}
                    <div className="flex gap-3 pt-2">
                      <button onClick={saveVirola} disabled={vSaving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                        <Check size={16}/> {vSaving?"Guardando...":"Guardar virola"}
                      </button>
                      <button onClick={()=>{setShowVForm(false);setCanvasReady(false);}}
                        className="px-4 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Layers size={15} className="text-emerald-600"/>
                      <h3 className="font-medium text-gray-700 text-xs uppercase tracking-wide">Diseño base</h3>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Opcional</span>
                    </div>
                    <div className="bg-gray-50 rounded-2xl border flex items-center justify-center overflow-hidden" style={{height:300}}>
                      <div style={{transform:"scale(0.55)",transformOrigin:"center center",width:500,height:500,flexShrink:0}}>
                        <VirolaCanvasCore ref={canvasRef} bgColor={bgColor} onReady={()=>setCanvasReady(true)}/>
                      </div>
                    </div>
                    {canvasReady && <CanvasToolbar canvasRef={canvasRef}/>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {vLoading ? (
            <div className="text-center py-12 text-gray-400">Cargando...</div>
          ) : virolas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CircleDot size={40} strokeWidth={1} className="mx-auto mb-3 text-gray-300"/>
              <p className="mb-3">No hay virolas todavía.</p>
              <button onClick={()=>{setEditingV(null);setVForm(EMPTY_VIROLA);setShowVForm(true);}} className="text-emerald-600 hover:underline text-sm">Crear la primera</button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Virola</th>
                    <th className="px-4 py-3 text-left">Material</th>
                    <th className="px-4 py-3 text-left">Ø mm</th>
                    <th className="px-4 py-3 text-left">Precio</th>
                    <th className="px-4 py-3 text-center">Diseño base</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {virolas.map(v=>(
                    <tr key={v.id} className={v.activa?"":"opacity-50"}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {v.imageUrl?<img src={v.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover"/>
                            :<div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">{v.diametroMm}</div>}
                          <div><p className="font-medium text-gray-900">{v.nombre}</p><p className="text-xs text-gray-400">{v.slug}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{v.material}</td>
                      <td className="px-4 py-3 text-gray-600">{v.diametroMm}mm</td>
                      <td className="px-4 py-3 font-medium">${Number(v.precioBase).toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-center">
                        {v.disenoBase
                          ? <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full"><Layers size={10}/> Con diseño</span>
                          : <span className="text-xs text-gray-400">Sin diseño</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={()=>toggleVirola(v)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${v.activa?"bg-emerald-100 text-emerald-700 hover:bg-emerald-200":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                          {v.activa?"Activa":"Inactiva"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={()=>{setEditingV(v);setVForm({nombre:v.nombre,slug:v.slug,descripcion:v.descripcion??"",material:v.material,diametroMm:v.diametroMm,precioBase:v.precioBase,imageUrl:v.imageUrl,disenoBase:v.disenoBase});setShowVForm(true);setVError("");setCanvasReady(false);}}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><Pencil size={14}/></button>
                          <button onClick={()=>delVirola(v)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}

      {tab === "perfiles" && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={()=>{setEditingP(null);setPForm(EMPTY_PERFIL);setShowPForm(true);setPError("");}}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={16}/> Nuevo perfil
            </button>
          </div>
          {showPForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b">
                  <h2 className="font-semibold text-lg flex items-center gap-2"><Zap size={18} className="text-orange-600"/>{editingP?"Editar perfil":"Nuevo perfil de láser"}</h2>
                  <button onClick={()=>setShowPForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nombre *</label>
                    <input value={pForm.nombre} onChange={e=>setPForm(f=>({...f,nombre:e.target.value}))}
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ej: Madera 40W"/>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Material aplicable</label>
                    <select value={pForm.material} onChange={e=>setPForm(f=>({...f,material:e.target.value}))}
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500">
                      {MATERIALES.map(m=><option key={m} value={m}>{m==="todos"?"Todos los materiales":m}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[["Potencia %","potencia",1,100],["Velocidad","velocidad",1,9999],["Pasadas","pasadas",1,10]].map(([label,key,min,max])=>(
                      <div key={key as string}>
                        <label className="text-sm font-medium text-gray-700">{label}</label>
                        <input type="number" min={min as number} max={max as number} value={(pForm as any)[key as string]}
                          onChange={e=>setPForm(f=>({...f,[key as string]:Number(e.target.value)}))}
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"/>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Notas</label>
                    <textarea value={pForm.notas} onChange={e=>setPForm(f=>({...f,notas:e.target.value}))}
                      rows={2} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                  </div>
                  {pError&&<p className="text-sm text-red-600">{pError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={savePerfil} disabled={pSaving}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                      <Check size={16}/> {pSaving?"Guardando...":"Guardar"}
                    </button>
                    <button onClick={()=>setShowPForm(false)} className="px-4 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {pLoading?<div className="text-center py-12 text-gray-400">Cargando...</div>:perfiles.length===0?(
            <div className="text-center py-16 text-gray-400"><Zap size={40} strokeWidth={1} className="mx-auto mb-3 text-orange-300"/><p>No hay perfiles.</p></div>
          ):(
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr><th className="px-4 py-3 text-left">Perfil</th><th className="px-4 py-3 text-left">Material</th><th className="px-4 py-3 text-center">Potencia</th><th className="px-4 py-3 text-center">Velocidad</th><th className="px-4 py-3 text-center">Pasadas</th><th className="px-4 py-3"/></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {perfiles.map(p=>(
                    <tr key={p.id}>
                      <td className="px-4 py-3"><p className="font-medium text-gray-900">{p.nombre}</p>{p.notas&&<p className="text-xs text-gray-400">{p.notas}</p>}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{p.material}</td>
                      <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full text-xs">⚡ {p.potencia}%</span></td>
                      <td className="px-4 py-3 text-center text-gray-700">{p.velocidad} mm/s</td>
                      <td className="px-4 py-3 text-center text-gray-700">{p.pasadas}×</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={()=>{setEditingP(p);setPForm({nombre:p.nombre,material:p.material,potencia:p.potencia,velocidad:p.velocidad,pasadas:p.pasadas,notas:p.notas??""});setShowPForm(true);setPError("");}}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><Pencil size={14}/></button>
                          <button onClick={()=>delPerfil(p)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
