"use client";

import { useEffect, useState } from "react";
import { Tags, Plus, Trash2, Check, Pencil, ImagePlus } from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";

interface Categoria { id: string; name: string; productos: number; imageUrl?: string | null }

export default function CategoriasPage() {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState("");
  const [creando, setCreando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [msg, setMsg] = useState("");

  async function cargar() {
    setCargando(true);
    const r = await fetch("/api/categorias");
    setCats(await r.json().catch(() => []));
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  async function crear() {
    if (!nueva.trim()) return;
    setCreando(true); setMsg("");
    const r = await fetch("/api/categorias", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nueva.trim() }),
    });
    setCreando(false);
    if (r.ok) { setNueva(""); cargar(); } else setMsg("No se pudo crear");
  }

  async function guardarNombre(id: string) {
    if (!editName.trim()) return;
    const r = await fetch(`/api/categorias/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName.trim() }),
    });
    if (r.ok) { setEditId(null); cargar(); } else setMsg("No se pudo renombrar");
  }

  const [imgId, setImgId] = useState<string | null>(null);
  async function guardarImagen(id: string, url: string | null) {
    await fetch(`/api/categorias/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: url }),
    });
    cargar();
  }

  async function borrar(c: Categoria) {
    const aviso = c.productos > 0
      ? `Borrar "${c.name}"? Sus ${c.productos} producto(s) quedarán sin categoría.`
      : `Borrar "${c.name}"?`;
    if (!confirm(aviso)) return;
    const r = await fetch(`/api/categorias/${c.id}`, { method: "DELETE" });
    if (r.ok) cargar();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Tags className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-500">Creá, renombrá y borrá las categorías de tus productos.</p>
        </div>
      </div>

      {msg && <p className="text-sm text-red-500">{msg}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-2">
        <input value={nueva} onChange={e => setNueva(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") crear(); }}
          placeholder="Nueva categoría (ej: Línea Premium)"
          className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400" />
        <button onClick={crear} disabled={creando || !nueva.trim()}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
          <Plus size={16} /> Crear
        </button>
      </div>

      {cargando ? <p className="text-sm text-gray-400">Cargando...</p> : cats.length === 0 ? (
        <p className="text-sm text-gray-400">Todavía no hay categorías.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {cats.map(c => (
            <div key={c.id} className="p-3">
              <div className="flex items-center gap-3">
                {/* Miniatura de la categoría (imagen del círculo en la home) */}
                <button onClick={() => setImgId(imgId === c.id ? null : c.id)} title="Cambiar imagen"
                  className="w-11 h-11 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 hover:ring-2 hover:ring-emerald-300">
                  {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" /> : <ImagePlus size={16} className="text-gray-400" />}
                </button>
                {editId === c.id ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === "Enter") guardarNombre(c.id); if (e.key === "Escape") setEditId(null); }}
                      className="flex-1 text-sm border rounded-lg px-2 py-1.5 outline-none" />
                    <button onClick={() => guardarNombre(c.id)} className="text-emerald-600 hover:text-emerald-800"><Check size={16} /></button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.productos} producto(s){c.imageUrl ? "" : " · sin imagen"}</p>
                    </div>
                    <button onClick={() => { setEditId(c.id); setEditName(c.name); }} className="text-gray-400 hover:text-gray-700" title="Renombrar"><Pencil size={15} /></button>
                    <button onClick={() => borrar(c)} className="text-gray-400 hover:text-red-500" title="Borrar"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
              {/* Panel para subir/cambiar la imagen de la categoría */}
              {imgId === c.id && (
                <div className="mt-3 pl-14 space-y-2">
                  <p className="text-xs text-gray-500">Imagen del círculo en la home (cuadrada, fondo claro queda mejor):</p>
                  <MediaUpload urls={c.imageUrl ? [c.imageUrl] : []} onChange={(urls) => guardarImagen(c.id, urls[urls.length - 1] ?? null)} />
                  {c.imageUrl && <button onClick={() => guardarImagen(c.id, null)} className="text-xs text-red-500 hover:underline">Quitar imagen (vuelve a usar la foto de un producto)</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
