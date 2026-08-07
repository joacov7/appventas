export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarAlertaTelegram } from "@/lib/telegram";

// Avisa al dueño por Telegram que entró un pedido nuevo (usado por el checkout
// mayorista). No expone datos sensibles: solo notifica al canal del dueño.
export async function POST(req: NextRequest) {
  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId requerido" }, { status: 400 });
  try {
    const order = await prisma.order.findUnique({
      where: { id: String(orderId) },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    const ars = (n: any) => "$" + Math.round(Number(n)).toLocaleString("es-AR");
    const dir: any = order.shippingAddress ?? {};
    const lineas = order.items.map(i => `• ${i.quantity}× ${i.product?.name ?? "producto"} — ${ars(i.subtotal)}`).join("\n");
    const msg = [
      `🛒 <b>Nuevo pedido mayorista</b>`,
      `<b>${dir.fullName ?? "Cliente"}</b>${dir.city ? ` · ${dir.city}, ${dir.province ?? ""}` : ""}`,
      dir.phone ? `📱 ${dir.phone}` : "",
      order.guestEmail ? `✉️ ${order.guestEmail}` : "",
      "",
      lineas,
      "",
      `<b>Total: ${ars(order.total)}</b>`,
      order.notes ? `📝 ${order.notes}` : "",
      ``,
      `Verlo en Órdenes del panel.`,
    ].filter(Boolean).join("\n");

    await enviarAlertaTelegram(msg).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
