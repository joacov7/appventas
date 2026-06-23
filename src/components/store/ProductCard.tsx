"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import type { ProductPublic } from "@/types/product";

interface ProductCardProps {
  product: ProductPublic;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);

  const mainVariant = product.variants[0];
  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const hasStock = product.variants.some((v) => v.stock > 0);
  const mainImage = product.imageUrls[0] ?? "/images/placeholder.png";

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
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Image
          src={mainImage}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />
        {product.featured && (
          <div className="absolute top-2 left-2">
            <Badge variant="success">Destacado</Badge>
          </div>
        )}
        {!hasStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Badge variant="danger">Sin stock</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1">
        {product.category && (
          <span className="text-xs text-gray-400 uppercase tracking-wide">
            {product.category.name}
          </span>
        )}
        <h3 className="font-semibold text-gray-900 line-clamp-2 leading-snug">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-2">
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
      </div>
    </Link>
  );
}
