"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CircleDot } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCartStore } from "@/store/cartStore";

const VirolaCanvas = dynamic(
  () => import("@/components/store/VirolaCanvas").then(m => ({ default: m.VirolaCanvas })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96 text-gray-400">Cargando editor...</div> }
);

interface Virola {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  material: string;
  diametroMm: number;
  precioBase: string;
  imageUrl: string | null;
}

export default function PersonalizarPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [virola, setVirola] = useState<Virola | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    fetch("/api/virolas")
      .then(r => r.json())
      .then((all: Virola[]) => {
        const found = all.find(v => v.slug === slug);
        if (!found) router.replace("/virolas");
        else setVirola(found);
      })
      .finally(() => setLoading(false));
  }, [slug, router]);

  const handleAddToCart = useCallback((preview: string, datos: object) => {
    if (!virola) return;
    const cartKey = `virola-${virola.id}-${Date.now()}`;
    addItem({
      cartKey,
      variantId: `virola-${virola.id}`,
      productId: `virola-${virola.id}`,
      productName: virola.nombre,
      variantName: "Personalizada",
      price: Number(virola.precioBase),
      imageUrl: virola.imageUrl,
      stock: 999,
      slug: `virolas/${virola.slug}/personalizar`,
      diseno: {
        preview,
        datos,
        virolaId: virola.id,
        virolaSlug: virola.slug,
        virolaName: virola.nombre,
      },
    });
  }, [virola, addItem]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CircleDot size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!virola) return null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/virolas" className="flex items-center gap-1 hover:text-gray-900">
          <ArrowLeft size={14} /> Volver al catálogo
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{virola.nombre}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {virola.material} · {virola.diametroMm}mm · ${Number(virola.precioBase).toLocaleString("es-AR")} c/u
        </p>
        {virola.descripcion && <p className="text-sm text-gray-600 mt-2">{virola.descripcion}</p>}
      </div>

      <VirolaCanvas virola={virola} onAddToCart={handleAddToCart} />
    </main>
  );
}
