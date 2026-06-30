"use client";

import { useEffect, useState } from "react";
import { Settings, Check } from "lucide-react";
import { MediaUpload } from "@/components/ui/MediaUpload";
import Image from "next/image";

export default function ConfiguracionPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/store-config")
      .then(r => r.json())
      .then(data => {
        setLogoUrl(data.logoUrl ?? null);
        setStoreName(data.storeName ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/store-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl, storeName }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>;

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings size={20} className="text-emerald-600" />
        <h1 className="text-2xl font-bold text-gray-900">Configuración general</h1>
      </div>

      <div className="bg-white rounded-2xl border p-6 space-y-6">
        {/* Logo */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Logo de la tienda</label>
          {logoUrl && (
            <div className="mb-3 relative h-16 w-48">
              <Image src={logoUrl} alt="Logo" fill className="object-contain" unoptimized />
            </div>
          )}
          <MediaUpload
            urls={logoUrl ? [logoUrl] : []}
            onChange={urls => setLogoUrl(urls[0] ?? null)}
          />
          <p className="text-xs text-gray-400 mt-1">Recomendado: PNG o SVG con fondo transparente, alto máximo 80px.</p>
        </div>

        {/* Nombre */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la tienda</label>
          <input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder="Pava Negra"
            className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-400 mt-1">Se muestra si no hay logo cargado.</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium"
        >
          {saved ? <><Check size={15} /> Guardado</> : saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
