import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Depósito: armado/preparación de pedidos ─────────────────────────────────
// Un pedido pasa por: para armar → armando (se tildan los ítems) → listo/con
// faltante (recién ahí se puede imprimir etiqueta) → despachado.

export interface PedidoResumen {
  order_id: string;
  cliente: string;
  ciudad: string | null;
  total: number;
  items: number;
  creado: string;
  estado: string; // para_armar | armando | listo | con_faltante | despachado
  armador: string | null;
}

// Lista de pedidos que el depósito tiene que trabajar (no despachados).
export async function pedidosParaArmar(): Promise<PedidoResumen[]> {
  await ensureSchema("deposito", "ordenes");
  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    SELECT o.id AS order_id, o."shippingAddress" AS dir, o.total::float AS total, o."createdAt" AS creado,
           COALESCE(pp.estado, 'para_armar') AS estado, pp.armador,
           (SELECT COUNT(*)::int FROM order_items oi WHERE oi."orderId" = o.id) AS items
    FROM orders o
    LEFT JOIN pedido_preparacion pp ON pp.order_id = o.id
    WHERE COALESCE(pp.estado, '') <> 'despachado'
    ORDER BY o."createdAt" DESC
    LIMIT 100
  `);
  return rows.map(r => ({
    order_id: r.order_id,
    cliente: r.dir?.fullName ?? "Cliente",
    ciudad: r.dir?.city ?? null,
    total: Number(r.total),
    items: Number(r.items),
    creado: r.creado,
    estado: r.estado,
    armador: r.armador ?? null,
  }));
}

export interface ItemPrep {
  order_item_id: string;
  producto: string;
  variante: string | null;
  pedido: number;      // cantidad pedida
  controlado: number;  // unidades ya controladas
  faltante: number;    // unidades declaradas faltantes
}

export interface Preparacion {
  order_id: string;
  estado: string;
  armador: string | null;
  cliente: string;
  direccion: any;
  email: string | null;
  notas: string | null;
  items: ItemPrep[];
  completo: boolean;   // todos los ítems resueltos (controlado + faltante = pedido)
  hayFaltante: boolean;
}

// Abre (o reabre) la preparación de un pedido y crea las filas de control.
export async function iniciarPreparacion(orderId: string, armador: string): Promise<void> {
  await ensureSchema("deposito", "ordenes");
  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO pedido_preparacion (order_id, estado, armador, iniciado_en, updated_at)
    VALUES ($1, 'armando', $2, now(), now())
    ON CONFLICT (order_id) DO UPDATE SET estado = 'armando', armador = COALESCE(pedido_preparacion.armador, $2), updated_at = now()
  `, orderId, armador || null);
  // Crea una fila de control por cada ítem del pedido (idempotente).
  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO pedido_preparacion_item (order_item_id, order_id, controlado, faltante)
    SELECT oi.id, oi."orderId", 0, 0 FROM order_items oi WHERE oi."orderId" = $1
    ON CONFLICT (order_item_id) DO NOTHING
  `, orderId);
}

export async function getPreparacion(orderId: string): Promise<Preparacion | null> {
  await ensureSchema("deposito", "ordenes");
  const ord = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { select: { name: true } }, variant: { select: { name: true } } } } },
  });
  if (!ord) return null;
  const prep: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT estado, armador FROM pedido_preparacion WHERE order_id = $1`, orderId);
  const controles: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT order_item_id, controlado, faltante FROM pedido_preparacion_item WHERE order_id = $1`, orderId);
  const cMap = new Map(controles.map(c => [c.order_item_id, c]));

  const items: ItemPrep[] = ord.items.map(i => {
    const c = cMap.get(i.id);
    return {
      order_item_id: i.id,
      producto: i.product?.name ?? "Producto",
      variante: i.variant?.name ?? null,
      pedido: i.quantity,
      controlado: Number(c?.controlado ?? 0),
      faltante: Number(c?.faltante ?? 0),
    };
  });
  const completo = items.every(i => i.controlado + i.faltante >= i.pedido);
  const hayFaltante = items.some(i => i.faltante > 0);
  const dir: any = ord.shippingAddress ?? {};

  return {
    order_id: ord.id,
    estado: prep[0]?.estado ?? "para_armar",
    armador: prep[0]?.armador ?? null,
    cliente: dir.fullName ?? "Cliente",
    direccion: dir,
    email: ord.guestEmail ?? null,
    notas: ord.notes ?? null,
    items,
    completo,
    hayFaltante,
  };
}

// Actualiza el control de un ítem (unidades controladas y faltantes).
export async function actualizarItem(orderId: string, orderItemId: string, controlado: number, faltante: number): Promise<void> {
  await ensureSchema("deposito", "ordenes");
  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO pedido_preparacion_item (order_item_id, order_id, controlado, faltante, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (order_item_id) DO UPDATE SET controlado = $3, faltante = $4, updated_at = now()
  `, orderItemId, orderId, Math.max(0, controlado), Math.max(0, faltante));
}

// Cierra la preparación: SOLO si todo está resuelto. Devuelve el estado final.
export async function cerrarPreparacion(orderId: string): Promise<{ ok: boolean; estado?: string; error?: string }> {
  const p = await getPreparacion(orderId);
  if (!p) return { ok: false, error: "Pedido no encontrado" };
  if (!p.completo) return { ok: false, error: "Todavía hay ítems sin controlar. Tildá o marcá faltante en todos antes de cerrar." };
  const estado = p.hayFaltante ? "con_faltante" : "listo";
  await (prisma as any).$executeRawUnsafe(
    `UPDATE pedido_preparacion SET estado = $2, cerrado_en = now(), updated_at = now() WHERE order_id = $1`,
    orderId, estado);
  return { ok: true, estado };
}

export async function marcarDespachado(orderId: string): Promise<void> {
  await ensureSchema("deposito", "ordenes");
  await (prisma as any).$executeRawUnsafe(
    `UPDATE pedido_preparacion SET estado = 'despachado', updated_at = now() WHERE order_id = $1`, orderId);
}
