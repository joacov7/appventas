import { prisma } from "@/lib/prisma";

export interface PosicionCompetencia {
  competidores: number;
  mercado_min: number | null;
  mercado_prom: number | null;
  mercado_max: number | null;
}

// Precios de la competencia para un producto propio (según links confirmados).
export async function consultarCompetencia(productId: string): Promise<PosicionCompetencia> {
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT COUNT(pc.id)::int AS competidores,
             MIN(pc.precio)::float AS mn,
             AVG(pc.precio)::float AS prom,
             MAX(pc.precio)::float AS mx
      FROM producto_competidor_links l
      JOIN productos_competidores pc ON pc.id = l.competidor_id AND pc.disponible = TRUE
      WHERE l.product_id = $1 AND l.estado = 'confirmado'
    `, productId);
    const r = rows[0] ?? {};
    return {
      competidores: r.competidores ?? 0,
      mercado_min: r.mn ?? null,
      mercado_prom: r.prom ?? null,
      mercado_max: r.mx ?? null,
    };
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
