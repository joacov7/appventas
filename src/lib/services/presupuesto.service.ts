import { prisma } from "@/lib/prisma";
import { getCostos } from "./productos.service";

export interface ItemPresupuesto { productId: string; cantidad: number; }
export interface LineaPresupuesto {
  producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  es_mayorista: boolean;
}
export interface Presupuesto {
  lineas: LineaPresupuesto[];
  total: number;
  total_items: number;
  faltantes: string[];
}

// Calcula un presupuesto para una lista de productos. Usa precio mayorista si
// está configurado; si no, el precio de la variante más barata. No persiste nada.
export async function calcularPresupuesto(items: ItemPresupuesto[]): Promise<Presupuesto> {
  const ids = items.map(i => i.productId);
  const [productos, costos] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      include: { variants: { where: { active: true } } },
    }),
    getCostos(ids),
  ]);

  const lineas: LineaPresupuesto[] = [];
  const faltantes: string[] = [];
  let total = 0, totalItems = 0;

  for (const it of items) {
    const p = productos.find(x => x.id === it.productId);
    if (!p) { faltantes.push(it.productId); continue; }
    const precios = p.variants.map(v => Number(v.price)).filter(n => n > 0);
    const minorista = precios.length ? Math.min(...precios) : 0;
    const mayorista = costos[p.id]?.mayorista ?? null;
    const unit = mayorista ?? minorista;
    if (!unit) { faltantes.push(p.name); continue; }
    const subtotal = unit * it.cantidad;
    lineas.push({
      producto: p.name,
      cantidad: it.cantidad,
      precio_unitario: unit,
      subtotal,
      es_mayorista: mayorista != null,
    });
    total += subtotal;
    totalItems += it.cantidad;
  }

  return { lineas, total, total_items: totalItems, faltantes };
}
