import { prisma } from "@/lib/prisma";
import { detectarVentaCruzada } from "@/lib/agents/oportunidades.logic";
import type { OportunidadCruzada } from "@/lib/agents/oportunidades.logic";

// ─── Oportunidades / Venta cruzada (Fase 5C) ─────────────────────────────────
// Detecta pares de productos que se compran juntos (co-ocurrencia en órdenes) y,
// por cliente, sugiere el complementario que todavía no compró. Determinístico,
// solo datos reales. No infiere causalidad: es correlación de canasta.

const ESTADOS = "('PROCESSING','SHIPPED','DELIVERED')";

export interface ParComplementario {
  a: string; b: string; nombre_a: string | null; nombre_b: string | null; co: number;
}

// Pares de productos comprados en la MISMA orden, ordenados por co-ocurrencia.
export async function paresComplementarios(minCo = 2, limit = 300): Promise<ParComplementario[]> {
  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    SELECT a."productId" AS a, b."productId" AS b,
           pa.name AS nombre_a, pb.name AS nombre_b, COUNT(*)::int AS co
    FROM order_items a
    JOIN order_items b ON b."orderId" = a."orderId" AND a."productId" < b."productId"
    JOIN orders o ON o.id = a."orderId" AND o.status IN ${ESTADOS}
    LEFT JOIN products pa ON pa.id = a."productId"
    LEFT JOIN products pb ON pb.id = b."productId"
    GROUP BY a."productId", b."productId", pa.name, pb.name
    HAVING COUNT(*) >= ${Math.max(1, minCo)}
    ORDER BY co DESC
    LIMIT ${limit}
  `).catch(() => []);
  return rows.map(r => ({ a: r.a, b: r.b, nombre_a: r.nombre_a, nombre_b: r.nombre_b, co: Number(r.co) }));
}

export interface ClienteProductos { email: string; nombre: string; productos: string[] }

// Productos comprados por cada cliente (identificado por email de la web).
export async function productosPorCliente(limit = 3000): Promise<ClienteProductos[]> {
  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    SELECT COALESCE(u.email, o."guestEmail") AS email,
           COALESCE(u.name, o."guestEmail") AS nombre,
           oi."productId" AS producto
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId" AND o.status IN ${ESTADOS}
    LEFT JOIN users u ON u.id = o."userId"
    WHERE COALESCE(u.email, o."guestEmail") IS NOT NULL
    LIMIT ${limit}
  `).catch(() => []);
  const map = new Map<string, ClienteProductos>();
  for (const r of rows) {
    const email = String(r.email).toLowerCase().trim();
    const g: ClienteProductos = map.get(email) ?? { email, nombre: r.nombre ?? email, productos: [] };
    if (!g.productos.includes(r.producto)) g.productos.push(r.producto);
    map.set(email, g);
  }
  return [...map.values()];
}

// Oportunidades de venta cruzada listas para el agente (pares × clientes).
export async function oportunidadesVentaCruzada(maxPorCliente = 3): Promise<OportunidadCruzada[]> {
  const [pares, clientes] = await Promise.all([paresComplementarios(), productosPorCliente()]);
  return detectarVentaCruzada(pares, clientes, { maxPorCliente });
}
