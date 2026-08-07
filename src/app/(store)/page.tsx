export const dynamic = "force-dynamic";

import { ProductCard } from "@/components/store/ProductCard";
import { HeroSlider } from "@/components/store/HeroSlider";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ProductPublic } from "@/types/product";

async function getHomeData() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const [featuredProducts, categories, heroSlides] = await Promise.all([
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
      prisma.heroSlide.findMany({
        where: { active: true },
        orderBy: { position: "asc" },
      }),
    ]);

    // Imagen representativa por categoría: la propia, o la 1ª foto de un producto.
    const categoriasConImagen = await Promise.all(categories.map(async (c) => {
      let imagen: string | null = c.imageUrl ?? null;
      if (!imagen) {
        const p = await prisma.product.findFirst({
          where: { active: true, categoryId: c.id, imageUrls: { isEmpty: false } },
          orderBy: { featured: "desc" }, select: { imageUrls: true },
        }).catch(() => null);
        imagen = p?.imageUrls?.[0] ?? null;
      }
      return { id: c.id, name: c.name, slug: c.slug, imagen };
    }));

    return { featuredProducts, categories: categoriasConImagen, heroSlides };
  } catch {
    return { featuredProducts: [], categories: [], heroSlides: [] };
  }
}

export default async function HomePage() {
  const { featuredProducts, categories, heroSlides } = await getHomeData();

  return (
    <div>
      {/* Hero Slider */}
      {heroSlides.length > 0 ? (
        <HeroSlider slides={heroSlides} />
      ) : (
        <section className="bg-gradient-to-br from-emerald-50 to-teal-50 py-16 px-4">
          <div className="max-w-4xl mx-auto text-center space-y-5">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              Bienvenido a <span className="text-emerald-600">Regionales por Mayor</span>
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
      )}

      {/* Categorías (círculos con foto) */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Nuestras categorías</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-6">
            {categories.map((cat: any) => (
              <Link key={cat.id} href={`/productos?category=${cat.slug}`} className="group flex flex-col items-center gap-2">
                <div className="aspect-square w-full rounded-full overflow-hidden border-2 border-gray-100 group-hover:border-emerald-400 transition-colors bg-gray-50 flex items-center justify-center">
                  {cat.imagen ? (
                    <img src={cat.imagen} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <span className="text-3xl">🧉</span>
                  )}
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700 text-center group-hover:text-emerald-700 leading-tight">{cat.name}</span>
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
