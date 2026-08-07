import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Resumen del día para el dashboard unificado ─────────────────────────────
// Junta en una sola llamada lo accionable de todo el negocio. Cada bloque tiene
// su propio try/catch: si una tabla todavía no existe, ese número queda en 0 y
// el resto del panel funciona igual.

export interface ResumenDashboard {
  pedidosArmar: number;        // pedidos activos en depósito (sin despachar)
  pedidosSinArmar: number;     // los que ni se empezaron a armar
  ordenesPendientes: number;   // órdenes en estado PENDING
  convSinResponder: number;    // conversaciones de WhatsApp sin respuesta
  prospectosNuevos: number;    // leads sin contactar
  stockBajo: number;           // variantes activas con stock <= umbral
  stockCero: number;           // variantes activas sin stock
  ingresosMes: number;         // ingresos aprobados del mes en curso
}

const UMBRAL_STOCK_BAJO = 5;
const MINUTOS_ESPERA = 45;

async function cuenta(sql: string, ...args: any[]): Promise<number> {
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(sql, ...args);
    return Number(rows[0]?.n ?? 0);
  } catch { return 0; }
}

export async function resumenDashboard(): Promise<ResumenDashboard> {
  const [
    pedidosArmar, pedidosSinArmar, convSinResponder, prospectosNuevos,
    stockBajo, stockCero,
  ] = await Promise.all([
    (async () => { await ensureSchema("deposito", "ordenes").catch(() => {});
      return cuenta(`SELECT COUNT(*)::int AS n FROM orders o
        LEFT JOIN pedido_preparacion pp ON pp.order_id = o.id
        WHERE COALESCE(pp.estado, '') <> 'despachado'`); })(),
    (async () => { await ensureSchema("deposito", "ordenes").catch(() => {});
      return cuenta(`SELECT COUNT(*)::int AS n FROM orders o
        LEFT JOIN pedido_preparacion pp ON pp.order_id = o.id
        WHERE pp.order_id IS NULL OR pp.estado = 'para_armar'`); })(),
    (async () => { await ensureSchema("whatsapp").catch(() => {});
      return cuenta(`WITH ult AS (
          SELECT DISTINCT ON (wa_id) wa_id, direccion, creado_en
          FROM whatsapp_mensajes ORDER BY wa_id, creado_en DESC)
        SELECT COUNT(*)::int AS n FROM ult
        WHERE direccion = 'entrante' AND creado_en < now() - interval '${MINUTOS_ESPERA} minutes'`); })(),
    (async () => { await ensureSchema("captacion").catch(() => {});
      return cuenta(`SELECT COUNT(*)::int AS n FROM prospectos WHERE estado = 'nuevo'`); })(),
    cuenta(`SELECT COUNT(*)::int AS n FROM product_variants WHERE active = true AND stock > 0 AND stock <= ${UMBRAL_STOCK_BAJO}`),
    cuenta(`SELECT COUNT(*)::int AS n FROM product_variants WHERE active = true AND stock <= 0`),
  ]);

  let ordenesPendientes = 0;
  let ingresosMes = 0;
  try {
    const desde = new Date();
    desde.setDate(1); desde.setHours(0, 0, 0, 0);
    const [pend, agg] = await Promise.all([
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.transaction.aggregate({ where: { status: "APPROVED", createdAt: { gte: desde } }, _sum: { amount: true } }),
    ]);
    ordenesPendientes = pend;
    ingresosMes = Number(agg._sum.amount ?? 0);
  } catch { /* deja 0 */ }

  return { pedidosArmar, pedidosSinArmar, ordenesPendientes, convSinResponder, prospectosNuevos, stockBajo, stockCero, ingresosMes };
}
