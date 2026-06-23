import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const shippingSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  street: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.string().min(1),
});

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1),
  shippingAddress: shippingSchema,
  guestEmail: z.string().email().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = createOrderSchema.parse(await req.json());

    // Validar stock de cada variante
    const variantIds = body.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
    });

    for (const item of body.items) {
      const variant = variants.find((v) => v.id === item.variantId);
      if (!variant) {
        return NextResponse.json(
          { error: `Variante ${item.variantId} no encontrada` },
          { status: 400 }
        );
      }
      if (variant.stock < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente para "${variant.name}"` },
          { status: 409 }
        );
      }
    }

    const subtotal = body.items.reduce(
      (acc, i) => acc + i.unitPrice * i.quantity,
      0
    );
    const total = subtotal; // podés agregar shipping después

    const order = await prisma.order.create({
      data: {
        userId: session?.user?.id ?? null,
        guestEmail: body.guestEmail ?? null,
        shippingAddress: body.shippingAddress,
        notes: body.notes,
        subtotal: subtotal.toString(),
        total: total.toString(),
        items: {
          create: body.items.map((item) => ({
            variantId: item.variantId,
            productId: variants.find((v) => v.id === item.variantId)!.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            subtotal: (item.unitPrice * item.quantity).toString(),
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("[ORDER_ERROR]", error);
    return NextResponse.json({ error: "Error al crear la orden" }, { status: 500 });
  }
}
