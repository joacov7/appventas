import { prisma } from "@/lib/prisma";

export interface ProductoResumen {
  id: string;
  nombre: string;
  slug: string;
  precio: number | null;
  costo: number | null;
  precio_mayorista: number | null;
  stock_total: number;
  activo: boolean;
}

// Busca productos por nombre (o lista los activos) con precio, costo y stock.
export async function buscarProductos(opts: { q?: string; limit?: number; soloActivos?: boolean } = {}): Promise<ProductoResumen[]> {
  const { q, limit = 20, soloActivos = true } = opts;
  const productos = await prisma.product.findMany({
    where: {
      ...(soloActivos ? { active: true } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: { variants: { where: { active: true } } },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const ids = productos.map(p => p.id);
  const costos = await getCostos(ids);

  return productos.map(p => {
    const precios = p.variants.map(v => Number(v.price)).filter(n => n > 0);
    return {
      id: p.id,
      nombre: p.name,
      slug: p.slug,
      precio: precios.length ? Math.min(...precios) : null,
      costo: costos[p.id]?.costo ?? null,
      precio_mayorista: costos[p.id]?.mayorista ?? null,
      stock_total: p.variants.reduce((a, v) => a + v.stock, 0),
      activo: p.active,
    };
  });
}

// Consulta stock de un producto (suma de variantes) o de una variante puntual.
export async function consultarStock(opts: { productId?: string; variantId?: string }): Promise<{ stock: number; detalle: { variante: string; stock: number }[] }> {
  const { productId, variantId } = opts;
  const variants = await prisma.productVariant.findMany({
    where: {
      active: true,
      ...(variantId ? { id: variantId } : {}),
      ...(productId ? { productId } : {}),
    },
    select: { name: true, stock: true },
  });
  return {
    stock: variants.reduce((a, v) => a + v.stock, 0),
    detalle: variants.map(v => ({ variante: v.name, stock: v.stock })),
  };
}

// Costos y precio mayorista desde product_pricing (tabla cruda).
export async function getCostos(productIds: string[]): Promise<Record<string, { costo: number | null; mayorista: number | null }>> {
  const out: Record<string, { costo: number | null; mayorista: number | null }> = {};
  if (!productIds.length) return out;
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT product_id, costo::float, precio_mayorista::float
       FROM product_pricing WHERE product_id = ANY($1::text[])`, productIds
    );
    for (const r of rows) out[r.product_id] = { costo: r.costo ?? null, mayorista: r.precio_mayorista ?? null };
  } catch { /* tabla puede no existir aún */ }
  return out;
}
