export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Pencil, Upload, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DeleteButton } from "./DeleteButton";
import { HerramientasCatalogo } from "./HerramientasCatalogo";

async function getProducts(q?: string) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const termino = q?.trim();
    return await prisma.product.findMany({
      where: {
        active: true,
        ...(termino ? {
          OR: [
            { name: { contains: termino, mode: "insensitive" } },
            { slug: { contains: termino, mode: "insensitive" } },
            { variants: { some: { sku: { contains: termino, mode: "insensitive" } } } },
          ],
        } : {}),
      },
      include: {
        category: { select: { name: true } },
        variants: { where: { active: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export default async function ProductosAdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const products = await getProducts(q);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/productos/importar"
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Upload size={16} /> Importar lista
          </Link>
          <Link
            href="/admin/productos/nuevo"
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus size={16} /> Nuevo producto
          </Link>
        </div>
      </div>

      <HerramientasCatalogo />

      {/* Buscador por nombre o código (SKU) */}
      <form method="GET" className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input name="q" defaultValue={q ?? ""} placeholder="Buscar por nombre o código…"
            className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <button type="submit" className="text-sm bg-gray-800 hover:bg-gray-900 text-white font-medium px-4 py-2 rounded-xl">Buscar</button>
        {q && <Link href="/admin/productos" className="text-sm text-gray-400 hover:text-gray-700">Limpiar</Link>}
      </form>
      {q && <p className="text-xs text-gray-500 mb-2">{products.length} resultado(s) para “{q}”.</p>}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Producto", "Categoría", "Variantes", "Stock total", "Precio desde", "Estado", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((product) => {
              const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);
              const minPrice = Math.min(...product.variants.map((v) => Number(v.price)));
              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      {(() => {
                        const cod = product.variants.find(v => v.sku)?.sku;
                        return cod
                          ? <p className="text-xs text-gray-500">Cód: <span className="font-mono">{cod}</span></p>
                          : <p className="text-xs text-gray-400">{product.slug}</p>;
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{product.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{product.variants.length}</td>
                  <td className="px-4 py-3">
                    <Badge variant={totalStock > 0 ? "success" : "danger"}>{totalStock}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {product.variants.length > 0
                      ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(minPrice)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={product.featured ? "info" : "default"}>
                      {product.featured ? "Destacado" : "Normal"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/productos/${product.id}/editar`}
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                        <Pencil size={13} /> Editar
                      </Link>
                      <DeleteButton id={product.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {products.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {q
              ? <>No se encontraron productos para “{q}”. <Link href="/admin/productos" className="text-emerald-600 hover:underline">Ver todos</Link>.</>
              : <>No hay productos. <Link href="/admin/productos/nuevo" className="text-emerald-600 hover:underline">Creá el primero</Link>.</>}
          </div>
        )}
      </div>
    </div>
  );
}
