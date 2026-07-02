// Empleado Virtual — Fase 1: Resumen Diario
// Recolecta señales de todos los módulos y genera un briefing accionable con IA.

import { prisma } from "./prisma";
import Anthropic from "@anthropic-ai/sdk";

export type DatosBriefing = {
  fecha: string;
  ventas_ayer: { cantidad: number; total: number };
  ordenes_por_despachar: number;
  carritos_abandonados_24h: number;
  stock_bajo: { producto: string; variante: string; stock: number }[];
  competencia_bajadas: { producto: string; competidor: string; tienda: string; precio: number; precio_anterior: number }[];
  posicion_cara: { producto: string; mi_precio: number; mercado_prom: number; margen_pct: number | null }[];
  prospectos_nuevos_24h: number;
  sin_rotacion_30d: { producto: string }[];
};

export type Accion = { titulo: string; detalle: string; modulo: string };
export type Briefing = { resumen: string; acciones: Accion[] };

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export async function recolectarDatos(): Promise<DatosBriefing> {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hace30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [ventasAyer, porDespachar, carritos, stockBajo, bajadas, posicionCara, prospectos, sinRotacion] =
    await Promise.all([
      safe(async () => {
        const rows = await prisma.order.findMany({
          where: { createdAt: { gte: ayer, lt: hoy }, status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] } },
          select: { total: true },
        });
        return { cantidad: rows.length, total: rows.reduce((a, r) => a + Number(r.total), 0) };
      }, { cantidad: 0, total: 0 }),

      safe(() => prisma.order.count({ where: { status: "PROCESSING" } }), 0),

      safe(async () => {
        const rows: any[] = await (prisma as any).$queryRawUnsafe(`
          SELECT COUNT(DISTINCT c.id)::int AS n
          FROM carts c JOIN cart_items ci ON ci."cartId" = c.id
          WHERE c."updatedAt" >= $1
        `, hace24h);
        return rows[0]?.n ?? 0;
      }, 0),

      safe(async () => {
        const rows = await prisma.productVariant.findMany({
          where: { active: true, stock: { lte: 5 }, product: { active: true } },
          select: { name: true, stock: true, product: { select: { name: true } } },
          orderBy: { stock: "asc" },
          take: 10,
        });
        return rows.map(r => ({ producto: r.product.name, variante: r.name, stock: r.stock }));
      }, [] as DatosBriefing["stock_bajo"]),

      safe(async () => {
        const rows: any[] = await (prisma as any).$queryRawUnsafe(`
          SELECT pr.name AS producto, pc.nombre AS competidor, t.nombre AS tienda,
                 pc.precio::float, pc.precio_anterior::float
          FROM producto_competidor_links l
          JOIN products pr ON pr.id = l.product_id
          JOIN productos_competidores pc ON pc.id = l.competidor_id
          JOIN tiendas_competidoras t ON t.id = pc.tienda_id
          WHERE l.estado = 'confirmado' AND pc.disponible = TRUE
            AND pc.precio_anterior IS NOT NULL AND pc.precio < pc.precio_anterior
          LIMIT 10
        `);
        return rows.map(r => ({ producto: r.producto, competidor: r.competidor, tienda: r.tienda, precio: Number(r.precio), precio_anterior: Number(r.precio_anterior) }));
      }, [] as DatosBriefing["competencia_bajadas"]),

      safe(async () => {
        const rows: any[] = await (prisma as any).$queryRawUnsafe(`
          SELECT pr.name AS producto,
                 (SELECT MIN(v.price)::float FROM product_variants v WHERE v."productId" = pr.id AND v.active = TRUE) AS mi_precio,
                 AVG(pc.precio)::float AS mercado_prom,
                 pp.costo::float AS costo
          FROM producto_competidor_links l
          JOIN products pr ON pr.id = l.product_id
          JOIN productos_competidores pc ON pc.id = l.competidor_id AND pc.disponible = TRUE
          LEFT JOIN product_pricing pp ON pp.product_id = pr.id
          WHERE l.estado = 'confirmado'
          GROUP BY pr.id, pr.name, pp.costo
        `);
        return rows
          .filter(r => r.mi_precio != null && r.mercado_prom && (r.mi_precio - r.mercado_prom) / r.mercado_prom > 0.10)
          .map(r => ({
            producto: r.producto,
            mi_precio: Number(r.mi_precio),
            mercado_prom: Number(r.mercado_prom),
            margen_pct: r.costo != null && r.mi_precio > 0 ? ((r.mi_precio - r.costo) / r.mi_precio) * 100 : null,
          }))
          .slice(0, 10);
      }, [] as DatosBriefing["posicion_cara"]),

      safe(async () => {
        const rows: any[] = await (prisma as any).$queryRawUnsafe(
          `SELECT COUNT(*)::int AS n FROM prospectos WHERE creado_en >= $1`, hace24h);
        return rows[0]?.n ?? 0;
      }, 0),

      safe(async () => {
        const rows: any[] = await (prisma as any).$queryRawUnsafe(`
          SELECT p.name AS producto FROM products p
          WHERE p.active = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM order_items oi
              JOIN orders o ON o.id = oi."orderId"
              WHERE oi."productId" = p.id AND o."createdAt" >= $1
            )
          ORDER BY p."createdAt" ASC
          LIMIT 8
        `, hace30d);
        return rows.map(r => ({ producto: r.producto }));
      }, [] as DatosBriefing["sin_rotacion_30d"]),
    ]);

  return {
    fecha: hoy.toISOString().slice(0, 10),
    ventas_ayer: ventasAyer,
    ordenes_por_despachar: porDespachar,
    carritos_abandonados_24h: carritos,
    stock_bajo: stockBajo,
    competencia_bajadas: bajadas,
    posicion_cara: posicionCara,
    prospectos_nuevos_24h: prospectos,
    sin_rotacion_30d: sinRotacion,
  };
}

const SYSTEM = `Sos el empleado virtual de una tienda argentina de mates, bombillas y regionales (venta minorista y mayorista).
Cada mañana recibís los datos del negocio y generás un briefing corto y accionable para el dueño.
Hablás en español argentino, directo y sin vueltas. No inventás datos: usás solo los que recibís.
Priorizá lo que genera plata o evita perderla. Si un dato viene vacío o en cero, no lo menciones salvo que sea una señal (ej: cero ventas).
Respondé SIEMPRE con JSON válido, sin markdown, con esta estructura exacta:
{"resumen": "2-4 oraciones con el estado del negocio hoy", "acciones": [{"titulo": "acción corta imperativa", "detalle": "1-2 oraciones con el dato concreto y qué hacer", "modulo": "ordenes|productos|inteligencia|captacion|combos|marketing"}]}
Máximo 5 acciones, ordenadas por impacto económico.`;

export async function generarBriefing(datos: DatosBriefing): Promise<Briefing> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: `Datos de hoy:\n${JSON.stringify(datos, null, 2)}` }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("La IA no devolvió un briefing válido");
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    resumen: String(parsed.resumen ?? ""),
    acciones: Array.isArray(parsed.acciones)
      ? parsed.acciones.slice(0, 5).map((a: any) => ({
          titulo: String(a.titulo ?? ""),
          detalle: String(a.detalle ?? ""),
          modulo: String(a.modulo ?? "ordenes"),
        }))
      : [],
  };
}

export async function ensureBriefingTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS briefings (
      id        SERIAL PRIMARY KEY,
      fecha     DATE UNIQUE NOT NULL,
      datos     JSONB NOT NULL,
      resumen   TEXT NOT NULL,
      acciones  JSONB NOT NULL,
      creado_en TIMESTAMPTZ DEFAULT now()
    )
  `);
}

// Genera (o regenera) el briefing del día y lo persiste.
export async function generarYGuardarBriefing() {
  await ensureBriefingTable();
  const datos = await recolectarDatos();
  const briefing = await generarBriefing(datos);
  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    INSERT INTO briefings (fecha, datos, resumen, acciones)
    VALUES ($1::date, $2::jsonb, $3, $4::jsonb)
    ON CONFLICT (fecha) DO UPDATE SET
      datos = EXCLUDED.datos, resumen = EXCLUDED.resumen,
      acciones = EXCLUDED.acciones, creado_en = now()
    RETURNING *
  `, datos.fecha, JSON.stringify(datos), briefing.resumen, JSON.stringify(briefing.acciones));
  return rows[0];
}
