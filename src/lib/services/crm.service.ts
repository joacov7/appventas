import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { scoreCliente } from "@/lib/agents/crm.logic";
import type { CustomerScore } from "@/lib/agents/crm.logic";

// ─── CRM: agregación de compras por cliente (Fase 5B) ────────────────────────
// Reúne compras de la web (orders) y ventas registradas (manual/presupuestos),
// agrupadas por cliente, con las FECHAS de cada compra para poder calcular
// frecuencia y riesgo de abandono. Determinístico, solo datos reales.

export interface MetricasCliente {
  key: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  compras: number;
  total_gastado: number;
  ticket_promedio: number;
  ultima_compra: string;        // ISO
  dias_desde_ultima: number;
  frecuencia_dias: number | null; // gap promedio entre compras (null si 1 sola)
}

export async function metricasClientes(): Promise<MetricasCliente[]> {
  const porCliente = new Map<string, {
    email: string | null; telefono: string | null; nombre: string; fechas: number[]; total: number;
  }>();

  function acumular(key: string, d: { email: string | null; telefono: string | null; nombre: string; total: number; fecha: Date }) {
    const g = porCliente.get(key) ?? { email: d.email, telefono: d.telefono, nombre: d.nombre, fechas: [], total: 0 };
    g.fechas.push(d.fecha.getTime());
    g.total += d.total;
    if (!g.email && d.email) g.email = d.email;
    if (!g.telefono && d.telefono) g.telefono = d.telefono;
    porCliente.set(key, g);
  }

  // 1) Ventas web.
  try {
    const ordenes = await prisma.order.findMany({
      where: { status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] as any } },
      select: { total: true, createdAt: true, guestEmail: true, user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" }, take: 2000,
    });
    for (const o of ordenes) {
      const email = (o.user?.email ?? o.guestEmail ?? "").toLowerCase().trim() || null;
      if (!email) continue;
      acumular(email, { email, telefono: null, nombre: o.user?.name ?? email.split("@")[0], total: Number(o.total), fecha: o.createdAt });
    }
  } catch { /* sin web */ }

  // 2) Ventas registradas.
  try {
    await ensureSchema("ventas_registradas");
    const ventas: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT cliente_nombre, cliente_email, cliente_telefono, total::float, fecha FROM ventas ORDER BY fecha DESC LIMIT 2000`);
    for (const v of ventas) {
      const email = (v.cliente_email ?? "").toLowerCase().trim() || null;
      const tel = (v.cliente_telefono ?? "").trim() || null;
      const nombre = v.cliente_nombre ?? email?.split("@")[0] ?? tel ?? "Cliente";
      const key = email || tel || `n:${nombre.toLowerCase()}`;
      acumular(key, { email, telefono: tel, nombre, total: Number(v.total), fecha: new Date(v.fecha) });
    }
  } catch { /* sin ventas registradas */ }

  const hoy = Date.now();
  const out: MetricasCliente[] = [];
  for (const [key, c] of porCliente) {
    const fechas = c.fechas.sort((a, b) => a - b);
    const ultima = fechas[fechas.length - 1];
    const compras = fechas.length;
    // Frecuencia = promedio de días entre compras (solo si hay 2+).
    let frecuencia: number | null = null;
    if (compras >= 2) {
      const span = (ultima - fechas[0]) / 86_400_000;
      frecuencia = Math.round(span / (compras - 1));
    }
    out.push({
      key, nombre: c.nombre, email: c.email, telefono: c.telefono,
      compras, total_gastado: Math.round(c.total),
      ticket_promedio: Math.round(c.total / compras),
      ultima_compra: new Date(ultima).toISOString(),
      dias_desde_ultima: Math.floor((hoy - ultima) / 86_400_000),
      frecuencia_dias: frecuencia,
    });
  }
  return out;
}

export type ClienteConScore = MetricasCliente & CustomerScore;

// Clientes con su Customer Score, ordenados de mayor a menor score.
export async function scoringClientes(limit = 100): Promise<ClienteConScore[]> {
  const ms = await metricasClientes();
  const maxValor = ms.reduce((mx, m) => Math.max(mx, m.total_gastado), 0);
  return ms
    .map(m => ({ ...m, ...scoreCliente(m, { maxValor }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
