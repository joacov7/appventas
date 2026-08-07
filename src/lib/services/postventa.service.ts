import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Postventa / Fidelización ─────────────────────────────────────────────────
// Detecta (determinísticamente) oportunidades después de la venta:
//  • reseña: compró y se le entregó hace pocos días → agradecer / pedir reseña.
//  • recompra: buen cliente que hace rato no compra → reactivar.
// La IA, si se usa, solo redacta el mensaje.

export type TipoPostventa = "resena" | "recompra";

export interface OportunidadPostventa {
  tipo: TipoPostventa;
  email: string | null;
  telefono: string | null;
  nombre: string;
  dias: number;            // días desde la última compra
  compras: number;         // cantidad de compras del cliente
  total_gastado: number;
  mensaje_sugerido: string;
}

const money = (n: number) => "$" + Math.round(Number(n)).toLocaleString("es-AR");

// Ventana para pedir reseña (entre 3 y 20 días desde la compra) y umbral de
// inactividad para proponer recompra (60 días).
const RESENA_MIN = 3, RESENA_MAX = 20, RECOMPRA_DIAS = 60;

interface ClienteAgg {
  email: string | null; telefono: string | null; nombre: string;
  compras: number; total: number; ultima: Date;
}

export async function oportunidadesPostventa(): Promise<OportunidadPostventa[]> {
  const porCliente = new Map<string, ClienteAgg>();

  // Clave de identidad del cliente: email, si no teléfono, si no nombre.
  function acumular(key: string, datos: { email: string | null; telefono: string | null; nombre: string; total: number; fecha: Date }) {
    const g = porCliente.get(key) ?? { email: datos.email, telefono: datos.telefono, nombre: datos.nombre, compras: 0, total: 0, ultima: datos.fecha };
    g.compras += 1;
    g.total += datos.total;
    if (datos.fecha > g.ultima) g.ultima = datos.fecha;
    if (!g.email && datos.email) g.email = datos.email;
    if (!g.telefono && datos.telefono) g.telefono = datos.telefono;
    porCliente.set(key, g);
  }

  // 1) Ventas de la web (orders).
  try {
    const ordenes = await prisma.order.findMany({
      where: { status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] as any } },
      select: { total: true, createdAt: true, guestEmail: true, user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    for (const o of ordenes) {
      const email = (o.user?.email ?? o.guestEmail ?? "").toLowerCase().trim() || null;
      if (!email) continue;
      acumular(email, { email, telefono: null, nombre: o.user?.name ?? email.split("@")[0], total: Number(o.total), fecha: o.createdAt });
    }
  } catch { /* sin web */ }

  // 2) Ventas registradas (manual + presupuestos aceptados).
  try {
    await ensureSchema("ventas_registradas");
    const ventas: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT cliente_nombre, cliente_email, cliente_telefono, total::float, fecha FROM ventas ORDER BY fecha DESC LIMIT 1000`
    );
    for (const v of ventas) {
      const email = (v.cliente_email ?? "").toLowerCase().trim() || null;
      const tel = (v.cliente_telefono ?? "").trim() || null;
      const nombre = v.cliente_nombre ?? email?.split("@")[0] ?? tel ?? "Cliente";
      const key = email || tel || `n:${nombre.toLowerCase()}`;
      acumular(key, { email, telefono: tel, nombre, total: Number(v.total), fecha: new Date(v.fecha) });
    }
  } catch { /* sin ventas registradas */ }

  const hoy = Date.now();
  const out: OportunidadPostventa[] = [];
  for (const c of porCliente.values()) {
    const dias = Math.floor((hoy - new Date(c.ultima).getTime()) / 86_400_000);

    if (dias >= RESENA_MIN && dias <= RESENA_MAX) {
      out.push({
        tipo: "resena", email: c.email, telefono: c.telefono, nombre: c.nombre, dias, compras: c.compras, total_gastado: c.total,
        mensaje_sugerido: `¡Hola ${c.nombre}! 👋 Gracias por tu compra 🙌 ¿Qué tal te fue con el producto? Si te gustó, nos ayudaría muchísimo una reseña. Y si necesitás algo más, acá estamos. ¡Gracias!`,
      });
    } else if (dias >= RECOMPRA_DIAS) {
      out.push({
        tipo: "recompra", email: c.email, telefono: c.telefono, nombre: c.nombre, dias, compras: c.compras, total_gastado: c.total,
        mensaje_sugerido: `¡Hola ${c.nombre}! 👋 Hace un tiempo no sabemos de vos. Sumamos novedades que te pueden gustar y tenemos combos nuevos. ¿Querés que te pase lo último? 🧉`,
      });
    }
  }

  // Prioridad: primero recompra de buenos clientes, luego reseñas recientes.
  return out.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "recompra" ? -1 : 1;
    return b.total_gastado - a.total_gastado;
  });
}

export interface ResumenPostventa {
  total: number;
  resenas: number;
  recompras: number;
  oportunidades: OportunidadPostventa[];
}

export async function resumenPostventa(): Promise<ResumenPostventa> {
  const oportunidades = await oportunidadesPostventa();
  return {
    total: oportunidades.length,
    resenas: oportunidades.filter(o => o.tipo === "resena").length,
    recompras: oportunidades.filter(o => o.tipo === "recompra").length,
    oportunidades,
  };
}
