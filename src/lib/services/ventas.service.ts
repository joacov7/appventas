import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Ventas registradas fuera de la web (manual + presupuestos aceptados).

export interface VentaRegistrada {
  id: number;
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  canal: string;
  total: number;
  detalle: any[];
  origen: string;
  presupuesto_id: number | null;
  fecha: string;
}

export const CANALES = ["mostrador", "whatsapp", "instagram", "mayorista", "otro"] as const;

export async function listarVentas(limit = 200): Promise<VentaRegistrada[]> {
  await ensureSchema("ventas_registradas");
  try {
    return await (prisma as any).$queryRawUnsafe(
      `SELECT id, cliente_nombre, cliente_email, cliente_telefono, canal,
              total::float, detalle, origen, presupuesto_id, fecha
       FROM ventas ORDER BY fecha DESC, id DESC LIMIT $1`, limit
    );
  } catch { return []; }
}

export async function registrarVenta(v: {
  cliente_nombre?: string; cliente_email?: string; cliente_telefono?: string;
  canal?: string; total: number; detalle?: any[]; fecha?: string;
}): Promise<VentaRegistrada> {
  await ensureSchema("ventas_registradas");
  const rows = await (prisma as any).$queryRawUnsafe(
    `INSERT INTO ventas (cliente_nombre, cliente_email, cliente_telefono, canal, total, detalle, origen, fecha)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,'manual',COALESCE($7::date, CURRENT_DATE))
     RETURNING id, cliente_nombre, cliente_email, cliente_telefono, canal, total::float, detalle, origen, presupuesto_id, fecha`,
    v.cliente_nombre?.trim() || null, v.cliente_email?.trim() || null, v.cliente_telefono?.trim() || null,
    v.canal || "mostrador", Number(v.total) || 0, JSON.stringify(v.detalle ?? []), v.fecha || null
  );
  return rows[0];
}

export async function eliminarVenta(id: number): Promise<void> {
  await ensureSchema("ventas_registradas");
  await (prisma as any).$executeRawUnsafe(`DELETE FROM ventas WHERE id = $1`, id).catch(() => {});
}

// Convierte un presupuesto aceptado en una venta (idempotente por presupuesto_id).
export async function registrarVentaDesdePresupuesto(p: {
  id: number; cliente_nombre?: string | null; cliente_empresa?: string | null;
  total: number; items?: any[]; canal?: string;
}): Promise<void> {
  await ensureSchema("ventas_registradas");
  const nombre = p.cliente_empresa || p.cliente_nombre || null;
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO ventas (cliente_nombre, canal, total, detalle, origen, presupuesto_id)
     VALUES ($1,$2,$3,$4::jsonb,'presupuesto',$5)
     ON CONFLICT (presupuesto_id) DO NOTHING`,
    nombre, p.canal === "mayorista" ? "mayorista" : "presupuesto", Number(p.total) || 0,
    JSON.stringify(p.items ?? []), p.id
  ).catch(() => {});
}

// Totales para Finanzas (todo lo registrado fuera de la web).
export async function totalesVentasRegistradas(): Promise<{ total: number; total_30d: number; cantidad: number }> {
  await ensureSchema("ventas_registradas");
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT
        COALESCE(SUM(total),0)::float AS total,
        COALESCE(SUM(total) FILTER (WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'),0)::float AS total_30d,
        COUNT(*)::int AS cantidad
      FROM ventas
    `);
    return { total: rows[0]?.total ?? 0, total_30d: rows[0]?.total_30d ?? 0, cantidad: rows[0]?.cantidad ?? 0 };
  } catch {
    return { total: 0, total_30d: 0, cantidad: 0 };
  }
}
