"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { slugify } from "@/lib/utils";

interface Variant {
  name: string;
  sku: string;
  price: string;
  stock: string;
}

interface Category {
  id: string;
  name: string;
}

export default function NuevoProductoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [featured, setFeatured] = useState(false);
  const [imageUrls, setImageUrls] = useState("");
  const [variants, setVariants] = useState<Variant[]>([
    { name: "Unidad", sku: "", price: "", stock: "" },
  ]);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSlug(slugify(name));
  }, [name]);

  function addVariant() {
    setVariants([...variants, { name: "", sku: "", price: "", stock: "" }]);
  }

  function removeVariant(i: number) {
    setVariants(variants.filter((_, idx) => idx !== i));
  }

  function updateVariant(i: number, field: keyof Variant, value: string) {
    setVariants(variants.map((v, idx) => (idx === i ? { ...v, [field]: value } : v)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          categoryId: categoryId || undefined,
          featured,
          imageUrls: imageUrls.split("\n").map((u) => u.trim()).filter(Boolean),
          variants: variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            price: parseFloat(v.price),
            stock: parseInt(v.stock),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(JSON.stringify(data.error));
      }

      router.push("/admin/productos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear producto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/productos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft size={16} /> Volver a productos
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo producto</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Información general</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URLs de imágenes (una por línea)</label>
            <textarea value={imageUrls} onChange={(e) => setImageUrls(e.target.value)} rows={3} placeholder="https://..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Producto destacado</span>
          </label>
        </div>

        {/* Variantes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Variantes *</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addVariant}>
              <Plus size={14} /> Agregar
            </Button>
          </div>

          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl relative">
              {variants.length > 1 && (
                <button type="button" onClick={() => removeVariant(i)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre variante *</label>
                <input value={v.name} onChange={(e) => updateVariant(i, "name", e.target.value)} required placeholder="ej: 250g"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SKU *</label>
                <input value={v.sku} onChange={(e) => updateVariant(i, "sku", e.target.value)} required placeholder="ej: PROD-001"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Precio (ARS) *</label>
                <input type="number" value={v.price} onChange={(e) => updateVariant(i, "price", e.target.value)} required min="0" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stock *</label>
                <input type="number" value={v.stock} onChange={(e) => updateVariant(i, "stock", e.target.value)} required min="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Crear producto
        </Button>
      </form>
    </div>
  );
}
