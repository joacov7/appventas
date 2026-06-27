"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ShoppingCart, ArrowLeft, Eye, Flame, Shield, Truck, CreditCard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatPrice, formatCuotas } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useViewers } from "@/hooks/useViewers";
import { WhatsAppButton, buildWaLink } from "@/components/store/WhatsAppButton";
import type { ProductPublic, ProductVariantPublic } from "@/types/product";

const LOW_STOCK_THRESHOLD = 5;

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductPublic | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const viewers = useViewers(slug);

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
  const isLowStock = hasStock && (selectedVariant?.stock ?? 0) <= LOW_STOCK_THRESHOLD;
  const cuotas = selectedVariant ? formatCuotas(selectedVariant.price) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/productos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft size={16} /> Volver al catálogo
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Imagen */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50">
          <Image src={mainImage} alt={product.name} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 50vw" />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          {product.category && (
            <span className="text-xs uppercase tracking-widest text-gray-400">{product.category.name}</span>
          )}

          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

          {/* Precio y cuotas */}
          {selectedVariant && (
            <div className="space-y-1">
              <p className="text-3xl font-bold text-emerald-700">{formatPrice(selectedVariant.price)}</p>
              {cuotas && hasStock && (
                <p className="text-sm text-gray-600">
                  {cuotas.cuotas} cuotas de{" "}
                  <span className="font-semibold text-emerald-600">{cuotas.valorCuota}</span>{" "}
                  <span className="text-emerald-600 font-medium">sin interés</span>
                </p>
              )}
            </div>
          )}

          {/* Social proof */}
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Eye size={14} className="text-emerald-600" />
              <span className="font-medium text-gray-700">{viewers}</span> personas viendo esto ahora
            </span>
          </div>

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
                    {v.stock === 0 && " · sin stock"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock urgencia */}
          <div>
            {!hasStock ? (
              <Badge variant="danger">Sin stock</Badge>
            ) : isLowStock ? (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                <Flame size={16} className="text-orange-500 shrink-0" />
                <p className="text-sm font-medium text-orange-700">
                  ¡Solo quedan <span className="font-bold">{selectedVariant?.stock}</span> unidades! No te quedes sin el tuyo.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                En stock — listo para despachar
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={handleAddToCart} disabled={!hasStock} className="flex-1">
              <ShoppingCart size={18} />
              {added ? "¡Agregado al carrito!" : "Agregar al carrito"}
            </Button>
            <WhatsAppButton
              variant="inline"
              label="Consultar"
              message={`Hola! Me interesa el producto *${product?.name}*${selectedVariant && product?.variants.length > 1 ? ` (${selectedVariant.name})` : ""}. ¿Tienen disponibilidad? ${typeof window !== "undefined" ? window.location.href : ""}`}
            />
          </div>

          {/* Garantías */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            {[
              { icon: CreditCard, label: "Pagás en cuotas", sub: "sin interés" },
              { icon: Truck, label: "Envío a todo", sub: "el país" },
              { icon: Shield, label: "Compra", sub: "protegida" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center text-center gap-1">
                <Icon size={18} className="text-emerald-600" />
                <p className="text-xs font-medium text-gray-700 leading-tight">{label}</p>
                <p className="text-xs text-gray-400 leading-tight">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
