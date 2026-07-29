export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Pencil, Upload, Search, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DeleteButton } from "./DeleteButton";
import { HerramientasCatalogo } from "./HerramientasCatalogo";

async function getProducts(q?: string, foto?: string) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const termino = q?.trim();
    return await prisma.product.findMany({
      where: {
        active: true,
        ...(foto === "sin" ? { imageUrls: { isEmpty: true } } : foto === "con" ? { imageUrls: { isEmpty: false } } : {}),
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

async function contarSinFoto() {
  try {
    const { prisma } = await import("@/lib/prisma");
    return await prisma.product.count({ where: { active: true, imageUrls: { isEmpty: true } } });
  } catch { return 0; }
}

export default async function ProductosAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; foto?: string }> }) {
  const { q, foto } = await searchParams;
  const [products, sinFoto] = await Promise.all([getProducts(q, foto), contarSinFoto()]);

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
        {(q || foto) && <Link href="/admin/productos" className="text-sm text-gray-400 hover:text-gray-700">Limpiar</Link>}
      </form>

      {/* Filtro por foto */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([["", "Todos"], ["con", "Con foto"], ["sin", "Sin foto"]] as const).map(([val, label]) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (val) params.set("foto", val);
          const activo = (foto ?? "") === val;
          const qs = params.toString();
          return (
            <Link key={label} href={`/admin/productos${qs ? `?${qs}` : ""}`}
              className={`text-xs px-3 py-1.5 rounded-full border ${activo ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
              {label}{val === "sin" && sinFoto > 0 ? ` (${sinFoto})` : ""}
            </Link>
          );
        })}
      </div>

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
                    <div className="flex items-center gap-3">
                      {product.imageUrls?.[0] ? (
                        <img src={product.imageUrls[0]} alt={product.name}
                          className="w-11 h-11 rounded-lg object-cover border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0" title="Sin foto">
                          <ImageOff size={16} className="text-amber-500" />
                        </div>
                      )}
                      <div>
                      <p className="font-medium text-gray-900">{product.name}
                        {!product.imageUrls?.[0] && <span className="ml-2 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full align-middle">Sin foto</span>}
                      </p>
                      {(() => {
                        const cod = product.variants.find(v => v.sku)?.sku;
                        return cod
                          ? <p className="text-xs text-gray-500">Cód: <span className="font-mono">{cod}</span></p>
                          : <p className="text-xs text-gray-400">{product.slug}</p>;
                      })()}
                      </div>
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
