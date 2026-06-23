import { NextRequest, NextResponse } from "next/server";
import { getMpPreference } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { orderId } = bodySchema.parse(body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true, imageUrls: true } },
            variant: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    // Solo el dueño de la orden o un admin pueden pagar
    if (order.userId && order.userId !== session?.user?.id) {
      return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const preference = await getMpPreference().create({
      body: {
        external_reference: order.id,
        items: order.items.map((item) => ({
          id: item.variantId,
          title: `${item.product.name} - ${item.variant.name}`,
          quantity: item.quantity,
          unit_price: Number(item.unitPrice),
          currency_id: "ARS",
          picture_url: item.product.imageUrls[0] ?? undefined,
        })),
        back_urls: {
          success: `${appUrl}/checkout/exito`,
          pending: `${appUrl}/checkout/pendiente`,
          failure: `${appUrl}/checkout/fallo`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/pagos/webhook`,
        payer: session?.user?.email
          ? { email: session.user.email }
          : order.guestEmail
          ? { email: order.guestEmail }
          : undefined,
        metadata: { order_id: order.id },
      },
    });

    // Guardar el preference_id en la transacción
    await prisma.transaction.upsert({
      where: { mpPreferenceId: preference.id } as never,
      create: {
        orderId: order.id,
        mpPreferenceId: preference.id ?? null,
        mpExternalRef: order.id,
        status: "PENDING",
      },
      update: {
        mpPreferenceId: preference.id ?? null,
      },
    });

    return NextResponse.json({
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (error) {
    console.error("[PREFERENCE_ERROR]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Error al crear la preferencia de pago" },
      { status: 500 }
    );
  }
}
