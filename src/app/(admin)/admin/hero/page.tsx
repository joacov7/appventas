"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MediaUpload } from "@/components/ui/MediaUpload";
import Image from "next/image";

interface Slide {
  id: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  position: number;
}

export default function HeroAdminPage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");

  useEffect(() => {
    fetch("/api/hero-slides").then((r) => r.json()).then(setSlides).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (imageUrls.length === 0) { setError("Seleccioná al menos una imagen"); return; }
    setSaving(true);
    setError("");
    try {
      const newSlides: Slide[] = [];
      for (const [i, url] of imageUrls.entries()) {
        const res = await fetch("/api/hero-slides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: url,
            title: title || undefined,
            subtitle: subtitle || undefined,
            buttonText: buttonText || undefined,
            buttonUrl: buttonUrl || undefined,
            position: slides.length + i,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data.error));
        newSlides.push(data);
      }
      setSlides([...slides, ...newSlides]);
      setShowForm(false);
      setImageUrls([]); setTitle(""); setSubtitle(""); setButtonText(""); setButtonUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este slide?")) return;
    await fetch(`/api/hero-slides/${id}`, { method: "DELETE" });
    setSlides(slides.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hero Slider</h1>
          <p className="text-sm text-gray-500 mt-1">Imágenes que se muestran en el inicio de la tienda</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Agregar slide
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Nuevo slide</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Imagen *</label>
            <MediaUpload urls={imageUrls} onChange={setImageUrls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="ej: Nueva colección"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                placeholder="ej: Descubrí los nuevos productos"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texto del botón</label>
              <input value={buttonText} onChange={(e) => setButtonText(e.target.value)}
                placeholder="ej: Ver productos"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL del botón</label>
              <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)}
                placeholder="ej: /productos"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={saving}>Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400">Cargando...</div>
      ) : slides.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400">
          No hay slides. Agregá el primero.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {slides.map((slide, i) => (
            <div key={slide.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden group">
              <div className="relative aspect-video bg-gray-100">
                <Image src={slide.imageUrl} alt={slide.title ?? `Slide ${i + 1}`} fill className="object-cover" sizes="400px" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                  <button onClick={() => handleDelete(slide.id)}
                    className="bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                  #{i + 1}
                </div>
              </div>
              <div className="p-4">
                {slide.title ? (
                  <p className="font-semibold text-gray-900 text-sm truncate">{slide.title}</p>
                ) : (
                  <p className="text-gray-400 text-sm italic">Sin título</p>
                )}
                {slide.subtitle && <p className="text-xs text-gray-500 truncate mt-0.5">{slide.subtitle}</p>}
                {slide.buttonText && (
                  <span className="inline-block mt-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                    Botón: {slide.buttonText}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
