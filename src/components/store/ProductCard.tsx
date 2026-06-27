"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Eye, Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatPrice, formatCuotas } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useViewers } from "@/hooks/useViewers";
import type { ProductPublic } from "@/types/product";

interface ProductCardProps {
  product: ProductPublic;
}

const LOW_STOCK_THRESHOLD = 5;

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const viewers = useViewers(product.id);

  const mainVariant = product.variants[0];
  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const hasStock = product.variants.some((v) => v.stock > 0);
  const minStock = Math.min(...product.variants.filter((v) => v.stock > 0).map((v) => v.stock));
  const isLowStock = hasStock && minStock <= LOW_STOCK_THRESHOLD;
  const mainImage = product.imageUrls[0] ?? "/images/placeholder.png";
  const cuotas = formatCuotas(minPrice);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (!mainVariant) return;
    addItem({
      variantId: mainVariant.id,
      productId: product.id,
      productName: product.name,
      variantName: mainVariant.name,
      price: mainVariant.price,
      imageUrl: mainVariant.imageUrl ?? product.imageUrls[0] ?? null,
      stock: mainVariant.stock,
      slug: product.slug,
    });
  }

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Imagen */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Image
          src={mainImage}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />

        {/* Badges superiores */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.featured && <Badge variant="success">Destacado</Badge>}
          {isLowStock && (
            <span className="flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <Flame size={10} /> ¡Últimos {minStock}!
            </span>
          )}
        </div>

        {/* Sin stock overlay */}
        {!hasStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Badge variant="danger">Sin stock</Badge>
          </div>
        )}

        {/* Viewers */}
        {hasStock && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
            <Eye size={10} /> {viewers} viendo
          </div>
        )}
        {product.imageUrls.length > 1 && (
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md">
            1 / {product.imageUrls.length}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        {product.category && (
          <span className="text-xs text-gray-400 uppercase tracking-wide">{product.category.name}</span>
        )}
        <h3 className="font-semibold text-gray-900 line-clamp-2 leading-snug">{product.name}</h3>

        <div className="mt-auto pt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-emerald-700">
              {product.variants.length > 1 && "Desde "}
              {formatPrice(minPrice)}
            </p>
            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={!hasStock}
              aria-label={`Agregar ${product.name} al carrito`}
            >
              <ShoppingCart size={15} />
            </Button>
          </div>

          {/* Cuotas */}
          {cuotas && hasStock && (
            <p className="text-xs text-gray-500">
              {cuotas.cuotas}x {cuotas.valorCuota}{" "}
              <span className="text-emerald-600 font-medium">sin interés</span>
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
