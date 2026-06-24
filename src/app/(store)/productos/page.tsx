export const dynamic = "force-dynamic";

import { ProductCard } from "@/components/store/ProductCard";
import Link from "next/link";

async function getProducts(category?: string, search?: string) {
  try {
    const { prisma } = await import("@/lib/prisma");
    return await prisma.product.findMany({
      where: {
        active: true,
        ...(category && { category: { slug: category } }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: { active: true }, orderBy: { price: "asc" } },
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    });
  } catch {
    return [];
  }
}

async function getCategories() {
  try {
    const { prisma } = await import("@/lib/prisma");
    return await prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  } catch {
    return [];
  }
}

interface Props {
  searchParams: Promise<{ category?: string; search?: string }>;
}

export default async function ProductosPage({ searchParams }: Props) {
  const { category, search } = await searchParams;
  const [products, categories] = await Promise.all([
    getProducts(category, search),
    getCategories(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Catálogo</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/productos"
          className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
            !category
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
          }`}
        >
          Todos
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/productos?category=${cat.slug}`}
            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
              category === cat.slug
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
            }`}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {/* Grid */}
      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No hay productos disponibles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
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
    </div>
  );
}
