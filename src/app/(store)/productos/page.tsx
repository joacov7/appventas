export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ProductCard } from "@/components/store/ProductCard";
import { CatalogoControls } from "@/components/store/CatalogoControls";
import { SearchX } from "lucide-react";
import { Aclaraciones } from "@/components/Aclaraciones";
import Link from "next/link";

const PAGE_SIZE = 24;

const ORDEN: Record<string, string> = {
  destacados: `p.featured DESC, p."createdAt" DESC`,
  nuevos: `p."createdAt" DESC`,
  precio_asc: `MIN(v.price) ASC NULLS LAST`,
  precio_desc: `MAX(v.price) DESC NULLS LAST`,
  nombre: `p.name ASC`,
};

// Devuelve los IDs de la página (ordenados) y el total, con una sola pasada de SQL
// que permite ordenar por "precio desde" (mínimo de las variantes) — algo que
// Prisma no puede hacer directo sobre una relación.
async function getPageIds(opts: { category?: string; search?: string; sort?: string; page: number }) {
  const { prisma } = await import("@/lib/prisma");
  const where: string[] = [`p.active = true`];
  const args: any[] = [];
  if (opts.category) { args.push(opts.category); where.push(`c.slug = $${args.length}`); }
  if (opts.search) {
    args.push(`%${opts.search}%`);
    where.push(`(p.name ILIKE $${args.length} OR p.description ILIKE $${args.length})`);
  }
  const whereSql = where.join(" AND ");
  const orderSql = ORDEN[opts.sort ?? "destacados"] ?? ORDEN.destacados;
  const offset = (opts.page - 1) * PAGE_SIZE;

  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT p.id
     FROM products p
     LEFT JOIN categories c ON c.id = p."categoryId"
     LEFT JOIN product_variants v ON v."productId" = p.id AND v.active = true
     WHERE ${whereSql}
     GROUP BY p.id
     ORDER BY ${orderSql}
     LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    ...args
  );
  const totalRows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT COUNT(DISTINCT p.id)::int AS total
     FROM products p
     LEFT JOIN categories c ON c.id = p."categoryId"
     WHERE ${whereSql}`,
    ...args
  );
  return { ids: rows.map(r => r.id) as string[], total: Number(totalRows[0]?.total ?? 0) };
}

async function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const { prisma } = await import("@/lib/prisma");
  const prods = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      variants: { where: { active: true }, orderBy: { price: "asc" } },
    },
  });
  // Reordenar según el orden que devolvió el SQL.
  const pos = new Map(ids.map((id, i) => [id, i]));
  return prods.sort((a, b) => (pos.get(a.id)! - pos.get(b.id)!));
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
  searchParams: Promise<{ category?: string; search?: string; sort?: string; page?: string }>;
}

function linkCon(sp: Record<string, string | undefined>, cambios: Record<string, string | undefined>) {
  const merged = { ...sp, ...cambios };
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) usp.set(k, v);
  const s = usp.toString();
  return s ? `/productos?${s}` : "/productos";
}

export default async function ProductosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { category, search, sort } = sp;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ ids, total }, categories] = await Promise.all([
    getPageIds({ category, search, sort, page }).catch(() => ({ ids: [], total: 0 })),
    getCategories(),
  ]);
  const products = await getProductsByIds(ids);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Catálogo</h1>

      <Suspense fallback={<div className="h-12 mb-6" />}>
        <CatalogoControls />
      </Suspense>

      {/* Filtros por categoría */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href={linkCon(sp, { category: undefined, page: undefined })}
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
            href={linkCon(sp, { category: cat.slug, page: undefined })}
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

      {/* Contador de resultados */}
      <p className="text-sm text-gray-500 mb-6">
        {total === 0
          ? "Sin resultados"
          : `${total} producto${total !== 1 ? "s" : ""}${search ? ` para “${search}”` : ""}`}
      </p>

      {/* Grid */}
      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <SearchX size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-lg text-gray-500">No encontramos productos con esos filtros.</p>
          <Link href="/productos" className="inline-block mt-3 text-sm text-emerald-600 hover:underline">
            Ver todo el catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={{
                ...product,
                variants: product.variants.map((v) => ({ ...v, price: Number(v.price) })),
              }}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          {page > 1 && (
            <Link href={linkCon(sp, { page: String(page - 1) })}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300 bg-white">
              ← Anterior
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-gray-500">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link href={linkCon(sp, { page: String(page + 1) })}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300 bg-white">
              Siguiente →
            </Link>
          )}
        </div>
      )}

      <div className="mt-12">
        <Aclaraciones />
      </div>
    </div>
  );
}
