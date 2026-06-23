export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/store/ProductCard";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  const [featuredProducts, categories] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, featured: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: { active: true }, orderBy: { price: "asc" } },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-50 to-teal-50 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Bienvenido a <span className="text-emerald-600">AppVentas</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Encontrá los mejores productos con envío a todo el país.
          </p>
          <Link
            href="/productos"
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            Ver catálogo <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Categorías */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Categorías</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/productos?category=${cat.slug}`}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors bg-white"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Productos destacados */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Productos destacados</h2>
          <Link
            href="/productos"
            className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
          >
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>

        {featuredProducts.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            Próximamente nuevos productos.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={{
                  ...product,
                  variants: product.variants.map((v) => ({
                    ...v,
                    price: Number(v.price),
                  })),
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
