export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

async function getProducts() {
  try {
    const { prisma } = await import("@/lib/prisma");
    return await prisma.product.findMany({
      where: { active: true },
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

export default async function ProductosAdminPage() {
  const products = await getProducts();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <Link
          href="/admin/productos/nuevo"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus size={16} /> Nuevo producto
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
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
                      <p className="text-xs text-gray-400">{product.slug}</p>
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
                    <Link href={`/admin/productos/${product.id}/editar`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                      <Pencil size={13} /> Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No hay productos. <Link href="/admin/productos/nuevo" className="text-emerald-600 hover:underline">Creá el primero</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
