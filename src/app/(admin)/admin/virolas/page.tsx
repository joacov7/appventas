"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";

interface Virola {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  material: string;
  diametroMm: number;
  precioBase: string;
  imageUrl: string | null;
  activa: boolean;
  posicion: number;
}

const EMPTY: Omit<Virola, "id" | "activa" | "posicion"> = {
  nombre: "",
  slug: "",
  descripcion: "",
  material: "madera",
  diametroMm: 35,
  precioBase: "",
  imageUrl: null,
};

export default function VirolasAdminPage() {
  const [virolas, setVirolas] = useState<Virola[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Virola | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/virolas");
    if (res.ok) setVirolas(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
    setError("");
  }

  function startEdit(v: Virola) {
    setEditing(v);
    setForm({
      nombre: v.nombre,
      slug: v.slug,
      descripcion: v.descripcion ?? "",
      material: v.material,
      diametroMm: v.diametroMm,
      precioBase: v.precioBase,
      imageUrl: v.imageUrl,
    });
    setShowForm(true);
    setError("");
  }

  function autoSlug(nombre: string) {
    return nombre.toLowerCase().trim()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function save() {
    if (!form.nombre.trim() || !form.precioBase) { setError("Nombre y precio son requeridos"); return; }
    setSaving(true);
    setError("");
    try {
      const slug = form.slug.trim() || autoSlug(form.nombre);
      const payload = { ...form, slug };
      const url = editing ? `/api/virolas/${editing.id}` : "/api/virolas";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActiva(v: Virola) {
    await fetch(`/api/virolas/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !v.activa }),
    });
    load();
  }

  async function del(v: Virola) {
    if (!confirm(`¿Eliminar "${v.nombre}"?`)) return;
    await fetch(`/api/virolas/${v.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Virolas</h1>
          <p className="text-sm text-gray-500 mt-1">Catálogo de virolas personalizables</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nueva virola
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-lg">{editing ? "Editar virola" : "Nueva virola"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value, slug: autoSlug(e.target.value) }))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ej: Virola Clásica 35mm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="virola-clasica-35mm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Precio base *</label>
                  <input
                    type="number"
                    value={form.precioBase}
                    onChange={(e) => setForm(f => ({ ...f, precioBase: e.target.value }))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="2500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Material</label>
                  <select
                    value={form.material}
                    onChange={(e) => setForm(f => ({ ...f, material: e.target.value }))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {["madera", "acero inoxidable", "alpaca", "cobre", "latón"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Diámetro (mm)</label>
                  <input
                    type="number"
                    value={form.diametroMm}
                    onChange={(e) => setForm(f => ({ ...f, diametroMm: Number(e.target.value) }))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Descripción</label>
                  <textarea
                    value={form.descripcion ?? ""}
                    onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    placeholder="Descripción del modelo..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Imagen de referencia</label>
                  <MediaUpload
                    urls={form.imageUrl ? [form.imageUrl] : []}
                    onChange={(urls) => setForm(f => ({ ...f, imageUrl: urls[urls.length - 1] ?? null }))}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={16} /> {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 border rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : virolas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-4">No hay virolas todavía.</p>
          <button onClick={startNew} className="text-emerald-600 hover:underline text-sm">Crear la primera</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Virola</th>
                <th className="px-4 py-3 text-left">Material</th>
                <th className="px-4 py-3 text-left">Ø mm</th>
                <th className="px-4 py-3 text-left">Precio</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {virolas.map((v) => (
                <tr key={v.id} className={v.activa ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {v.imageUrl ? (
                        <img src={v.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                          {v.diametroMm}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{v.nombre}</p>
                        <p className="text-xs text-gray-400">{v.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{v.material}</td>
                  <td className="px-4 py-3 text-gray-600">{v.diametroMm}mm</td>
                  <td className="px-4 py-3 font-medium">${Number(v.precioBase).toLocaleString("es-AR")}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActiva(v)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        v.activa ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {v.activa ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(v)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => del(v)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
