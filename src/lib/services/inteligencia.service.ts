import { prisma } from "@/lib/prisma";

export interface PosicionCompetencia {
  competidores: number;
  mercado_min: number | null;
  mercado_prom: number | null;
  mercado_max: number | null;
  descartados?: number;
}

function mediana(ordenados: number[]): number {
  const n = ordenados.length, m = Math.floor(n / 2);
  return n % 2 ? ordenados[m] : (ordenados[m - 1] + ordenados[m]) / 2;
}

// Estadísticas de mercado robustas: usa la mediana y descarta precios
// absurdos (fuera de [mediana×0.2, mediana×3]) para que un dato mal
// scrapeado (ej. $9.900.000) no distorsione el promedio ni el mínimo.
export function estadisticasMercado(preciosRaw: number[]): PosicionCompetencia {
  const precios = preciosRaw.filter(p => p > 0).sort((a, b) => a - b);
  if (!precios.length) return { competidores: 0, mercado_min: null, mercado_prom: null, mercado_max: null, descartados: 0 };
  const med = mediana(precios);
  const filtrados = precios.filter(p => p >= med * 0.2 && p <= med * 3);
  const usados = filtrados.length ? filtrados : precios;
  const prom = usados.reduce((a, b) => a + b, 0) / usados.length;
  return {
    competidores: precios.length,
    mercado_min: Math.min(...usados),
    mercado_prom: prom,
    mercado_max: Math.max(...usados),
    descartados: precios.length - usados.length,
  };
}

// Precios de la competencia para un producto propio (según links confirmados).
// Usa estadística robusta: la mediana filtra los precios mal scrapeados.
export async function consultarCompetencia(productId: string): Promise<PosicionCompetencia> {
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT pc.precio::float AS precio
      FROM producto_competidor_links l
      JOIN productos_competidores pc ON pc.id = l.competidor_id AND pc.disponible = TRUE
      WHERE l.product_id = $1 AND l.estado = 'confirmado'
    `, productId);
    return estadisticasMercado(rows.map(r => Number(r.precio)));
  } catch {
    return { competidores: 0, mercado_min: null, mercado_prom: null, mercado_max: null };
  }
}

// Busca productos de competidores por nombre (texto libre).
export async function buscarEnCompetencia(q: string, limit = 20): Promise<{ nombre: string; precio: number; tienda: string; url: string }[]> {
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT pc.nombre, pc.precio::float, t.nombre AS tienda, pc.url
      FROM productos_competidores pc
      JOIN tiendas_competidoras t ON t.id = pc.tienda_id
      WHERE pc.disponible = TRUE AND LOWER(pc.nombre) LIKE $1
      ORDER BY pc.precio ASC
      LIMIT $2
    `, `%${q.toLowerCase()}%`, limit);
    return rows.map(r => ({ nombre: r.nombre, precio: Number(r.precio), tienda: r.tienda, url: r.url }));
  } catch {
    return [];
  }
}
