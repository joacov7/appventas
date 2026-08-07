export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { getClienteSesion } from "@/lib/cliente-auth";
import { enviarAlertaTelegram } from "@/lib/telegram";

// GET: historial de pedidos del cliente logueado (por su email).
export async function GET() {
  const ses = await getClienteSesion();
  if (!ses) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  await ensureSchema("ordenes");
  const orders = await prisma.order.findMany({
    where: { guestEmail: ses.email },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: { include: { product: { select: { name: true } }, variant: { select: { name: true } } } } },
  }).catch(() => []);
  return NextResponse.json({ email: ses.email, pedidos: orders });
}

// POST: repite un pedido anterior (crea uno nuevo con los mismos ítems).
export async function POST(req: NextRequest) {
  const ses = await getClienteSesion();
  if (!ses) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  await ensureSchema("ordenes");
  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "Falta el pedido a repetir" }, { status: 400 });

  const orig = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!orig || orig.guestEmail !== ses.email) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  if (!orig.items.length) return NextResponse.json({ error: "El pedido no tiene ítems" }, { status: 400 });

  // Recalcula precios desde la base (nunca confiar en el histórico).
  const variantIds = orig.items.map(i => i.variantId);
  const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } } });
  const items = orig.items
    .map(i => {
      const v = variants.find(x => x.id === i.variantId);
      if (!v) return null;
      const price = Math.round((Number(v.price) || 0) * 100) / 100;
      return { variantId: i.variantId, productId: v.productId, quantity: i.quantity, price };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (!items.length) return NextResponse.json({ error: "Los productos del pedido ya no están disponibles" }, { status: 400 });

  const subtotal = Math.round(items.reduce((a, i) => a + i.price * i.quantity, 0) * 100) / 100;

  const nueva = await prisma.order.create({
    data: {
      guestEmail: ses.email,
      shippingAddress: orig.shippingAddress ?? undefined,
      notes: "[PEDIDO MAYORISTA] Repetido desde el portal",
      subtotal: subtotal.toString(),
      total: subtotal.toString(),
      items: {
        create: items.map(i => ({
          variantId: i.variantId, productId: i.productId, quantity: i.quantity,
          unitPrice: i.price.toString(), subtotal: (i.price * i.quantity).toString(),
        })),
      },
    },
  });

  enviarAlertaTelegram(
    `🔁 <b>Pedido repetido (portal mayorista)</b>\nCliente: ${ses.email}\nÍtems: ${items.length}\nTotal: $${subtotal.toLocaleString("es-AR")}\n\nEntra a Depósito para prepararlo.`
  ).catch(() => {});

  return NextResponse.json({ ok: true, orderId: nueva.id });
}
