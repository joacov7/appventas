import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { remember } from "@/lib/memory";

export const MARGEN_PISO_PCT = 15; // nunca sugerir un precio con margen menor a esto

export type SugerenciaPrecio = { precio: number; motivo: string; margen_resultante: number | null } | null;

function redondear(n: number): number {
  return Math.round(n / 100) * 100;
}

// Sugerencia determinística: alinear al mercado sin perforar el margen piso.
export function calcularSugerencia(
  miPrecio: number | null, costo: number | null,
  mercadoMin: number | null, prom: number | null
): SugerenciaPrecio {
  if (miPrecio == null || !prom || !mercadoMin) return null;
  const piso = costo != null ? costo * (1 + MARGEN_PISO_PCT / 100) : null;
  const margenDe = (precio: number) =>
    costo != null && precio > 0 ? ((precio - costo) / precio) * 100 : null;

  if (miPrecio > prom * 1.03) {
    let objetivo = redondear(prom);
    if (piso != null && objetivo < piso) objetivo = redondear(piso);
    if (objetivo >= miPrecio) return null;
    return {
      precio: objetivo,
      motivo: `Estás ${(((miPrecio - prom) / prom) * 100).toFixed(0)}% arriba del promedio del mercado`,
      margen_resultante: margenDe(objetivo),
    };
  }
  if (miPrecio < mercadoMin * 0.95) {
    const objetivo = redondear(mercadoMin * 0.99);
    if (objetivo <= miPrecio) return null;
    return {
      precio: objetivo,
      motivo: `Estás debajo del competidor más barato (${new Intl.NumberFormat("es-AR").format(mercadoMin)})`,
      margen_resultante: margenDe(objetivo),
    };
  }
  return null;
}

// Aplica un precio a la variante activa MÁS BARATA del producto (la que se
// compara contra el mercado) y registra el cambio en price_history.
export async function aplicarPrecioSugerido(
  productId: string, nuevoPrecio: number, usuario = "agente-comercial"
): Promise<{ ok: boolean; variante?: string; precio_anterior?: number; precio_nuevo?: number; sin_cambios?: boolean; error?: string }> {
  if (!productId || !Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
    return { ok: false, error: "productId y precio válido requeridos" };
  }
  const variante = await prisma.productVariant.findFirst({
    where: { productId: String(productId), active: true },
    orderBy: { price: "asc" },
  });
  if (!variante) return { ok: false, error: "El producto no tiene variantes activas" };

  const precioAnterior = Number(variante.price);
  if (precioAnterior === nuevoPrecio) return { ok: true, sin_cambios: true };

  await prisma.productVariant.update({ where: { id: variante.id }, data: { price: nuevoPrecio.toString() } });

  await ensureSchema("pricing");
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO price_history (product_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1,$2,$3,$4,$5)`,
    String(productId), `variante:${variante.name}`, precioAnterior, nuevoPrecio, usuario
  ).catch(() => {});

  remember({
    namespace: "decisiones", kind: "precio_aplicado",
    key: `precio:${productId}:${Date.now()}`,
    value: { productId, variante: variante.name, precio_anterior: precioAnterior, precio_nuevo: nuevoPrecio },
    source: usuario, tags: ["precio", "aceptada"], confidence: 0.8,
  }).catch(() => {});

  return { ok: true, variante: variante.name, precio_anterior: precioAnterior, precio_nuevo: nuevoPrecio };
}
