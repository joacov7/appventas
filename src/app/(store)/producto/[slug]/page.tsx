"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ShoppingCart, ArrowLeft, Eye, Flame, Shield, Truck, CreditCard, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatPrice, formatCuotas } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useViewers } from "@/hooks/useViewers";
import { WhatsAppButton, buildWaLink } from "@/components/store/WhatsAppButton";
import type { ProductPublic, ProductVariantPublic } from "@/types/product";
import { VolumePricing } from "@/components/store/VolumePricing";
import { SubscribeReposicion } from "@/components/store/SubscribeReposicion";
import { CuotasModal } from "@/components/store/CuotasModal";
import { useTiers, getBestTier, applyTier } from "@/hooks/useTiers";

const LOW_STOCK_THRESHOLD = 5;

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductPublic | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const viewers = useViewers(slug);
  const tiers = useTiers();
  const [quantity, setQuantity] = useState(1);
  const [showCuotas, setShowCuotas] = useState(false);

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

  function handleVariantSelect(v: ProductVariantPublic) {
    setSelectedVariant(v);
    setActiveImg(0); // reset to first image when switching variant
  }

  function handleAddToCart() {
    if (!product || !selectedVariant) return;
    const tier = getBestTier(tiers, quantity, selectedVariant.price);
    const finalPrice = applyTier(selectedVariant.price, tier);
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantName: selectedVariant.name,
      price: finalPrice,
      imageUrl: selectedVariant.imageUrl ?? product.imageUrls[0] ?? null,
      stock: selectedVariant.stock,
      slug: product.slug,
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  // Build image list: variant image first (if any), then product images
  const allImages = [
    ...(selectedVariant?.imageUrl ? [selectedVariant.imageUrl] : []),
    ...(product?.imageUrls ?? []).filter((u) => u !== selectedVariant?.imageUrl),
  ];
  if (allImages.length === 0) allImages.push("/images/placeholder.png");

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const prevLightbox = useCallback(() => setLightbox((i) => (i !== null ? (i - 1 + allImages.length) % allImages.length : null)), [allImages.length]);
  const nextLightbox = useCallback(() => setLightbox((i) => (i !== null ? (i + 1) % allImages.length : null)), [allImages.length]);

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevLightbox();
      if (e.key === "ArrowRight") nextLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox, prevLightbox, nextLightbox]);

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

  const hasStock = (selectedVariant?.stock ?? 0) > 0;
  const isLowStock = hasStock && (selectedVariant?.stock ?? 0) <= LOW_STOCK_THRESHOLD;
  const activeTier = selectedVariant ? getBestTier(tiers, quantity, selectedVariant.price) : null;
  const displayPrice = selectedVariant ? applyTier(selectedVariant.price, activeTier) : 0;
  const cuotas = displayPrice ? formatCuotas(displayPrice) : null;

  return (
    <>
    {showCuotas && selectedVariant && (
      <CuotasModal price={displayPrice} onClose={() => setShowCuotas(false)} />
    )}
    {/* Lightbox */}
    {lightbox !== null && (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={closeLightbox}>
        <button onClick={closeLightbox} className="absolute top-4 right-4 text-white/70 hover:text-white p-2">
          <X size={28} />
        </button>
        {allImages.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prevLightbox(); }}
              className="absolute left-4 text-white/70 hover:text-white p-2">
              <ChevronLeft size={36} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); nextLightbox(); }}
              className="absolute right-4 text-white/70 hover:text-white p-2">
              <ChevronRight size={36} />
            </button>
          </>
        )}
        <div className="relative w-full max-w-3xl max-h-[85vh] aspect-square mx-16" onClick={(e) => e.stopPropagation()}>
          <Image src={allImages[lightbox]} alt={product.name} fill className="object-contain" sizes="90vw" />
        </div>
        {allImages.length > 1 && (
          <div className="absolute bottom-4 flex gap-2">
            {allImages.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
                className={`w-2 h-2 rounded-full transition-colors ${i === lightbox ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        )}
      </div>
    )}

    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/productos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft size={16} /> Volver al catálogo
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Galería */}
        <div className="flex flex-col gap-3">
          {/* Imagen principal */}
          <div
            className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 cursor-zoom-in group"
            onClick={() => setLightbox(activeImg)}
          >
            <Image
              src={allImages[activeImg]}
              alt={product.name}
              fill className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute bottom-3 right-3 bg-black/40 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn size={16} />
            </div>
          </div>
          {/* Miniaturas */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                    i === activeImg ? "border-emerald-500" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <Image src={img} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
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
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-bold text-emerald-700">{formatPrice(displayPrice)}</p>
                {activeTier && (
                  <>
                    <span className="text-lg text-gray-400 line-through">{formatPrice(selectedVariant.price)}</span>
                    <span className="text-sm font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {activeTier.descuento_pct}% OFF
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {cuotas && hasStock && (
                  <p className="text-sm text-gray-600">
                    {cuotas.cuotas} cuotas de{" "}
                    <span className="font-semibold text-emerald-600">{cuotas.valorCuota}</span>{" "}
                    <span className="text-emerald-600 font-medium">sin interés</span>
                  </p>
                )}
                <button
                  onClick={() => setShowCuotas(true)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Ver cuotas
                </button>
              </div>
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
                    onClick={() => handleVariantSelect(v)}
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

          {/* Cantidad y precios por volumen */}
          {selectedVariant && hasStock && (
            <div className="space-y-3">
              {/* Quantity selector */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Cantidad</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-50 text-lg font-medium"
                    >−</button>
                    <span className="px-4 py-2 text-sm font-semibold text-gray-900 min-w-[40px] text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(selectedVariant.stock, q + 1))}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-50 text-lg font-medium"
                    >+</button>
                  </div>
                  {/* Tier quick-select buttons */}
                  {tiers.length > 0 && selectedVariant && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setQuantity(1)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${!activeTier ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                      >
                        Unidad
                      </button>
                      {tiers.map((tier) => {
                        const isActive = activeTier?.id === tier.id;
                        if (tier.tipo === "cantidad" && tier.min_qty != null) {
                          return (
                            <button
                              key={tier.id}
                              onClick={() => setQuantity(tier.min_qty!)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${isActive ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-600 hover:border-emerald-400"}`}
                            >
                              x{tier.min_qty} <span className="opacity-75">· {tier.descuento_pct}% OFF</span>
                            </button>
                          );
                        }
                        if (tier.tipo === "monto" && tier.min_monto != null) {
                          const approxUnits = Math.ceil(tier.min_monto / selectedVariant.price);
                          return (
                            <button
                              key={tier.id}
                              onClick={() => setQuantity(approxUnits)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${isActive ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-400"}`}
                            >
                              ≈{approxUnits}u <span className="opacity-75">· {tier.descuento_pct}% OFF</span>
                            </button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              </div>
              <VolumePricing basePrice={selectedVariant.price} currentQty={quantity} />
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

          {selectedVariant && hasStock && (
            <SubscribeReposicion
              variantId={selectedVariant.id}
              productName={product.name}
              variantName={selectedVariant.name}
              productSlug={product.slug}
            />
          )}

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
    </>
  );
}
