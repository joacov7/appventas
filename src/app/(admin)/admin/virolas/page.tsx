"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, Zap } from "lucide-react";
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

interface PerfilLaser {
  id: number;
  nombre: string;
  material: string;
  potencia: number;
  velocidad: number;
  pasadas: number;
  notas: string | null;
  activo: boolean;
}

const EMPTY_VIROLA = { nombre: "", slug: "", descripcion: "", material: "madera", diametroMm: 35, precioBase: "", imageUrl: null as string | null };
const EMPTY_PERFIL = { nombre: "", material: "todos", potencia: 80, velocidad: 100, pasadas: 1, notas: "" };

export default function VirolasAdminPage() {
  const [tab, setTab] = useState<"virolas" | "perfiles">("virolas");

  // ── Virolas state ──
  const [virolas, setVirolas] = useState<Virola[]>([]);
  const [vLoading, setVLoading] = useState(true);
  const [showVForm, setShowVForm] = useState(false);
  const [editingV, setEditingV] = useState<Virola | null>(null);
  const [vForm, setVForm] = useState(EMPTY_VIROLA);
  const [vSaving, setVSaving] = useState(false);
  const [vError, setVError] = useState("");

  // ── Perfiles state ──
  const [perfiles, setPerfiles] = useState<PerfilLaser[]>([]);
  const [pLoading, setPLoading] = useState(true);
  const [showPForm, setShowPForm] = useState(false);
  const [editingP, setEditingP] = useState<PerfilLaser | null>(null);
  const [pForm, setPForm] = useState(EMPTY_PERFIL);
  const [pSaving, setPSaving] = useState(false);
  const [pError, setPError] = useState("");

  async function loadVirolas() {
    const res = await fetch("/api/virolas");
    if (res.ok) setVirolas(await res.json());
    setVLoading(false);
  }

  async function loadPerfiles() {
    const res = await fetch("/api/virolas/perfiles");
    if (res.ok) setPerfiles(await res.json());
    setPLoading(false);
  }

  useEffect(() => { loadVirolas(); loadPerfiles(); }, []);

  function autoSlug(nombre: string) {
    return nombre.toLowerCase().trim()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // ── Virolas CRUD ──────────────────────────────────────────────────────────

  async function saveVirola() {
    if (!vForm.nombre.trim() || !vForm.precioBase) { setVError("Nombre y precio son requeridos"); return; }
    setVSaving(true); setVError("");
    try {
      const slug = vForm.slug.trim() || autoSlug(vForm.nombre);
      const url = editingV ? `/api/virolas/${editingV.id}` : "/api/virolas";
      const res = await fetch(url, {
        method: editingV ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vForm, slug }),
      });
      if (!res.ok) { setVError((await res.json()).error ?? "Error"); return; }
      setShowVForm(false);
      loadVirolas();
    } finally { setVSaving(false); }
  }

  async function toggleVirola(v: Virola) {
    await fetch(`/api/virolas/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activa: !v.activa }) });
    loadVirolas();
  }

  async function delVirola(v: Virola) {
    if (!confirm(`¿Eliminar "${v.nombre}"?`)) return;
    await fetch(`/api/virolas/${v.id}`, { method: "DELETE" });
    loadVirolas();
  }

  // ── Perfiles CRUD ─────────────────────────────────────────────────────────

  async function savePerfil() {
    if (!pForm.nombre.trim()) { setPError("Nombre requerido"); return; }
    setPSaving(true); setPError("");
    try {
      const url = editingP ? `/api/virolas/perfiles/${editingP.id}` : "/api/virolas/perfiles";
      const res = await fetch(url, {
        method: editingP ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pForm),
      });
      if (!res.ok) { setPError((await res.json()).error ?? "Error"); return; }
      setShowPForm(false);
      loadPerfiles();
    } finally { setPSaving(false); }
  }

  async function delPerfil(p: PerfilLaser) {
    if (!confirm(`¿Eliminar perfil "${p.nombre}"?`)) return;
    await fetch(`/api/virolas/perfiles/${p.id}`, { method: "DELETE" });
    loadPerfiles();
  }

  const MATERIALES = ["todos", "madera", "acero inoxidable", "alpaca", "cobre", "latón"];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Virolas</h1>
          <p className="text-sm text-gray-500 mt-1">Catálogo y perfiles de láser</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: "virolas", label: "Modelos" },
          { key: "perfiles", label: "Perfiles de láser" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Virolas ──────────────────────────────────────────────────────── */}
      {tab === "virolas" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditingV(null); setVForm(EMPTY_VIROLA); setShowVForm(true); setVError(""); }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
            >
              <Plus size={16} /> Nueva virola
            </button>
          </div>

          {/* Virola form modal */}
          {showVForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b">
                  <h2 className="font-semibold text-lg">{editingV ? "Editar virola" : "Nueva virola"}</h2>
                  <button onClick={() => setShowVForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700">Nombre *</label>
                      <input value={vForm.nombre} onChange={(e) => setVForm(f => ({ ...f, nombre: e.target.value, slug: autoSlug(e.target.value) }))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ej: Virola Clásica 35mm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Slug</label>
                      <input value={vForm.slug} onChange={(e) => setVForm(f => ({ ...f, slug: e.target.value }))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="virola-clasica-35mm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Precio base *</label>
                      <input type="number" value={vForm.precioBase} onChange={(e) => setVForm(f => ({ ...f, precioBase: e.target.value }))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="2500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Material</label>
                      <select value={vForm.material} onChange={(e) => setVForm(f => ({ ...f, material: e.target.value }))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                        {["madera", "acero inoxidable", "alpaca", "cobre", "latón"].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Diámetro (mm)</label>
                      <input type="number" value={vForm.diametroMm} onChange={(e) => setVForm(f => ({ ...f, diametroMm: Number(e.target.value) }))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700">Descripción</label>
                      <textarea value={vForm.descripcion ?? ""} onChange={(e) => setVForm(f => ({ ...f, descripcion: e.target.value }))}
                        rows={3} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Descripción del modelo..." />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1">Imagen</label>
                      <MediaUpload
                        urls={vForm.imageUrl ? [vForm.imageUrl] : []}
                        onChange={(urls) => setVForm(f => ({ ...f, imageUrl: urls[urls.length - 1] ?? null }))}
                      />
                    </div>
                  </div>
                  {vError && <p className="text-sm text-red-600">{vError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={saveVirola} disabled={vSaving}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                      <Check size={16} /> {vSaving ? "Guardando..." : "Guardar"}
                    </button>
                    <button onClick={() => setShowVForm(false)} className="px-4 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla virolas */}
          {vLoading ? (
            <div className="text-center py-12 text-gray-400">Cargando...</div>
          ) : virolas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="mb-3">No hay virolas todavía.</p>
              <button onClick={() => { setEditingV(null); setVForm(EMPTY_VIROLA); setShowVForm(true); }} className="text-emerald-600 hover:underline text-sm">Crear la primera</button>
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
                    <th className="px-4 py-3" />
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
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">{v.diametroMm}</div>
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
                        <button onClick={() => toggleVirola(v)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${v.activa ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                          {v.activa ? "Activa" : "Inactiva"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingV(v); setVForm({ nombre: v.nombre, slug: v.slug, descripcion: v.descripcion ?? "", material: v.material, diametroMm: v.diametroMm, precioBase: v.precioBase, imageUrl: v.imageUrl }); setShowVForm(true); setVError(""); }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"><Pencil size={14} /></button>
                          <button onClick={() => delVirola(v)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Perfiles de láser ────────────────────────────────────────────── */}
      {tab === "perfiles" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditingP(null); setPForm(EMPTY_PERFIL); setShowPForm(true); setPError(""); }}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
            >
              <Plus size={16} /> Nuevo perfil
            </button>
          </div>

          {/* Perfil form modal */}
          {showPForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Zap size={18} className="text-orange-600" />
                    {editingP ? "Editar perfil" : "Nuevo perfil de láser"}
                  </h2>
                  <button onClick={() => setShowPForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nombre del perfil *</label>
                    <input value={pForm.nombre} onChange={(e) => setPForm(f => ({ ...f, nombre: e.target.value }))}
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ej: Madera 40W — Grabado suave" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Material aplicable</label>
                    <select value={pForm.material} onChange={(e) => setPForm(f => ({ ...f, material: e.target.value }))}
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500">
                      {MATERIALES.map(m => <option key={m} value={m}>{m === "todos" ? "Todos los materiales" : m}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Potencia %</label>
                      <input type="number" min="1" max="100" value={pForm.potencia} onChange={(e) => setPForm(f => ({ ...f, potencia: Number(e.target.value) }))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Velocidad</label>
                      <input type="number" min="1" value={pForm.velocidad} onChange={(e) => setPForm(f => ({ ...f, velocidad: Number(e.target.value) }))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Pasadas</label>
                      <input type="number" min="1" max="10" value={pForm.pasadas} onChange={(e) => setPForm(f => ({ ...f, pasadas: Number(e.target.value) }))}
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Notas</label>
                    <textarea value={pForm.notas} onChange={(e) => setPForm(f => ({ ...f, notas: e.target.value }))}
                      rows={2} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none" placeholder="Observaciones del operario..." />
                  </div>
                  {pError && <p className="text-sm text-red-600">{pError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={savePerfil} disabled={pSaving}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                      <Check size={16} /> {pSaving ? "Guardando..." : "Guardar"}
                    </button>
                    <button onClick={() => setShowPForm(false)} className="px-4 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla perfiles */}
          {pLoading ? (
            <div className="text-center py-12 text-gray-400">Cargando...</div>
          ) : perfiles.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Zap size={40} strokeWidth={1} className="mx-auto mb-3 text-orange-300" />
              <p className="mb-3">No hay perfiles de láser.</p>
              <p className="text-xs max-w-xs mx-auto">Los perfiles se muestran al operario en el personalizador y se incluyen en el PDF de la orden.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Perfil</th>
                    <th className="px-4 py-3 text-left">Material</th>
                    <th className="px-4 py-3 text-center">Potencia</th>
                    <th className="px-4 py-3 text-center">Velocidad</th>
                    <th className="px-4 py-3 text-center">Pasadas</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {perfiles.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.nombre}</p>
                        {p.notas && <p className="text-xs text-gray-400">{p.notas}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{p.material}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          ⚡ {p.potencia}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{p.velocidad} mm/s</td>
                      <td className="px-4 py-3 text-center text-gray-700">{p.pasadas}×</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingP(p); setPForm({ nombre: p.nombre, material: p.material, potencia: p.potencia, velocidad: p.velocidad, pasadas: p.pasadas, notas: p.notas ?? "" }); setShowPForm(true); setPError(""); }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"><Pencil size={14} /></button>
                          <button onClick={() => delPerfil(p)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
