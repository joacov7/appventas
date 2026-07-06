import { prisma } from "@/lib/prisma";

// ─── Postventa / Fidelización ─────────────────────────────────────────────────
// Detecta (determinísticamente) oportunidades después de la venta:
//  • reseña: compró y se le entregó hace pocos días → agradecer / pedir reseña.
//  • recompra: buen cliente que hace rato no compra → reactivar.
// La IA, si se usa, solo redacta el mensaje.

export type TipoPostventa = "resena" | "recompra";

export interface OportunidadPostventa {
  tipo: TipoPostventa;
  email: string;
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
  email: string; nombre: string; compras: number; total: number; ultima: Date;
}

export async function oportunidadesPostventa(): Promise<OportunidadPostventa[]> {
  // Solo órdenes que representan una venta concretada.
  let ordenes: any[] = [];
  try {
    ordenes = await prisma.order.findMany({
      where: { status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] as any } },
      select: { total: true, createdAt: true, guestEmail: true, user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
  } catch { return []; }

  // Agrupar por cliente (email).
  const porCliente = new Map<string, ClienteAgg>();
  for (const o of ordenes) {
    const email = (o.user?.email ?? o.guestEmail ?? "").toLowerCase().trim();
    if (!email) continue;
    const nombre = o.user?.name ?? email.split("@")[0];
    const g = porCliente.get(email) ?? { email, nombre, compras: 0, total: 0, ultima: o.createdAt };
    g.compras += 1;
    g.total += Number(o.total);
    if (o.createdAt > g.ultima) g.ultima = o.createdAt;
    porCliente.set(email, g);
  }

  const hoy = Date.now();
  const out: OportunidadPostventa[] = [];
  for (const c of porCliente.values()) {
    const dias = Math.floor((hoy - new Date(c.ultima).getTime()) / 86_400_000);

    if (dias >= RESENA_MIN && dias <= RESENA_MAX) {
      out.push({
        tipo: "resena", email: c.email, nombre: c.nombre, dias, compras: c.compras, total_gastado: c.total,
        mensaje_sugerido: `¡Hola ${c.nombre}! 👋 Gracias por tu compra 🙌 ¿Qué tal te fue con el producto? Si te gustó, nos ayudaría muchísimo una reseña. Y si necesitás algo más, acá estamos. ¡Gracias!`,
      });
    } else if (dias >= RECOMPRA_DIAS) {
      out.push({
        tipo: "recompra", email: c.email, nombre: c.nombre, dias, compras: c.compras, total_gastado: c.total,
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
