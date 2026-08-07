import { prisma } from "@/lib/prisma";
import { estadisticasMercado } from "./inteligencia.service";

export type TipoAlerta = "caro" | "barato" | "competencia_bajo" | "ok";

export interface AlertaPrecio {
  product_id: string;
  producto: string;
  mi_precio: number | null;
  mercado_min: number | null;
  mercado_prom: number | null;
  competidores: number;
  tipo: TipoAlerta;
  severidad: number;        // 0..100, para ordenar
  diferencia_pct: number | null;
  mensaje: string;
}

export interface ResumenInteligencia {
  productos_monitoreados: number;
  caros: number;
  baratos: number;
  competencia_bajo: number;
  alertas: AlertaPrecio[];
}

const UMBRAL_CARO = 0.05;    // 5% por encima del promedio
const UMBRAL_BARATO = 0.05;  // 5% por debajo del mínimo de mercado

// Precio propio: la variante activa más barata (la que se compara al mercado).
async function misPrecios(productIds: string[]): Promise<Map<string, { nombre: string; precio: number | null }>> {
  const productos = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: { where: { active: true } } },
  });
  const map = new Map<string, { nombre: string; precio: number | null }>();
  for (const p of productos) {
    const precios = p.variants.map(v => Number(v.price)).filter(n => n > 0);
    map.set(p.id, { nombre: p.name, precio: precios.length ? Math.min(...precios) : null });
  }
  return map;
}

// Analiza todo el catálogo vinculado a competencia y arma alertas de precio.
// 100% determinístico: no usa IA.
export async function alertasPrecio(): Promise<ResumenInteligencia> {
  let links: any[] = [];
  try {
    links = await (prisma as any).$queryRawUnsafe(`
      SELECT l.product_id, pc.precio::float AS precio, pc.precio_anterior::float AS precio_anterior
      FROM producto_competidor_links l
      JOIN productos_competidores pc ON pc.id = l.competidor_id AND pc.disponible = TRUE
      WHERE l.estado = 'confirmado'
    `);
  } catch {
    return { productos_monitoreados: 0, caros: 0, baratos: 0, competencia_bajo: 0, alertas: [] };
  }

  // Agrupar por producto propio.
  const porProducto = new Map<string, { precios: number[]; bajo: boolean }>();
  for (const l of links) {
    const g = porProducto.get(l.product_id) ?? { precios: [], bajo: false };
    if (l.precio > 0) g.precios.push(Number(l.precio));
    // ¿Algún competidor bajó su precio respecto al anterior registrado?
    if (l.precio_anterior != null && l.precio > 0 && l.precio < l.precio_anterior) g.bajo = true;
    porProducto.set(l.product_id, g);
  }

  const ids = [...porProducto.keys()];
  if (ids.length === 0) return { productos_monitoreados: 0, caros: 0, baratos: 0, competencia_bajo: 0, alertas: [] };
  const mios = await misPrecios(ids);

  const alertas: AlertaPrecio[] = [];
  for (const [productId, g] of porProducto) {
    const info = mios.get(productId);
    const nombre = info?.nombre ?? productId;
    const miPrecio = info?.precio ?? null;
    const stats = estadisticasMercado(g.precios);

    let tipo: TipoAlerta = "ok";
    let severidad = 0;
    let diff: number | null = null;
    let mensaje = "En línea con el mercado.";

    if (miPrecio != null && stats.mercado_prom != null && miPrecio > stats.mercado_prom * (1 + UMBRAL_CARO)) {
      tipo = "caro";
      diff = ((miPrecio - stats.mercado_prom) / stats.mercado_prom) * 100;
      severidad = Math.min(100, Math.round(diff));
      mensaje = `Estás ${diff.toFixed(0)}% por encima del promedio del mercado.`;
    } else if (miPrecio != null && stats.mercado_min != null && miPrecio < stats.mercado_min * (1 - UMBRAL_BARATO)) {
      tipo = "barato";
      diff = ((stats.mercado_min - miPrecio) / stats.mercado_min) * 100;
      severidad = Math.min(90, Math.round(diff));
      mensaje = `Estás ${diff.toFixed(0)}% por debajo del competidor más barato. Podés subir sin perder ventaja.`;
    } else if (g.bajo) {
      tipo = "competencia_bajo";
      severidad = 40;
      mensaje = "Un competidor bajó su precio. Conviene revisar.";
    }

    alertas.push({
      product_id: productId, producto: nombre, mi_precio: miPrecio,
      mercado_min: stats.mercado_min, mercado_prom: stats.mercado_prom,
      competidores: stats.competidores, tipo, severidad,
      diferencia_pct: diff != null ? Math.round(diff) : null, mensaje,
    });
  }

  // Orden: primero lo más accionable (mayor severidad), "ok" al final.
  alertas.sort((a, b) => b.severidad - a.severidad);

  return {
    productos_monitoreados: alertas.length,
    caros: alertas.filter(a => a.tipo === "caro").length,
    baratos: alertas.filter(a => a.tipo === "barato").length,
    competencia_bajo: alertas.filter(a => a.tipo === "competencia_bajo").length,
    alertas,
  };
}
