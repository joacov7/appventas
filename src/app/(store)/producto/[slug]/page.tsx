"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import type { ProductPublic, ProductVariantPublic } from "@/types/product";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductPublic | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    fetch(`/api/productos/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        const p = { ...data, variants: data.variants.map((v: ProductVariantPublic) => ({ ...v, price: Number(v.price) })) };
        setProduct(p);
        setSelectedVariant(p.variants[0] ?? null);
        setLoading(false);
      });
  }, [slug]);

  function handleAddToCart() {
    if (!product || !selectedVariant) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantName: selectedVariant.name,
      price: selectedVariant.price,
      imageUrl: selectedVariant.imageUrl ?? product.imageUrls[0] ?? null,
      stock: selectedVariant.stock,
      slug: product.slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Producto no encontrado.</p>
        <Link href="/" className="text-emerald-600 hover:underline mt-4 inline-block">Volver al inicio</Link>
      </div>
    );
  }

  const mainImage = selectedVariant?.imageUrl ?? product.imageUrls[0] ?? "/images/placeholder.png";
  const hasStock = (selectedVariant?.stock ?? 0) > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft size={16} /> Volver
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Imagen */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50">
          <Image src={mainImage} alt={product.name} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 50vw" />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          {product.category && (
            <span className="text-xs uppercase tracking-widest text-gray-400">{product.category.name}</span>
          )}
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

          {selectedVariant && (
            <p className="text-3xl font-bold text-emerald-700">{formatPrice(selectedVariant.price)}</p>
          )}

          {product.description && (
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          )}

          {/* Variantes */}
          {product.variants.length > 1 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Opciones</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                      selectedVariant?.id === v.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    } ${v.stock === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                    disabled={v.stock === 0}
                  >
                    {v.name}
                    {v.stock === 0 && " (sin stock)"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock */}
          <div>
            {hasStock ? (
              <Badge variant="success">En stock ({selectedVariant?.stock} disponibles)</Badge>
            ) : (
              <Badge variant="danger">Sin stock</Badge>
            )}
          </div>

          <Button size="lg" onClick={handleAddToCart} disabled={!hasStock} className="w-full sm:w-auto">
            <ShoppingCart size={18} />
            {added ? "¡Agregado!" : "Agregar al carrito"}
          </Button>
        </div>
      </div>
    </div>
  );
}
