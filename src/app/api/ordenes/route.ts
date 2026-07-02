import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

async function getTiersFromDB(): Promise<{ min_qty: number; descuento_pct: number }[]> {
  try {
    return await (prisma as any).$queryRawUnsafe(
      `SELECT min_qty, descuento_pct::float FROM precio_tiers WHERE activo = true ORDER BY min_qty ASC`
    );
  } catch {
    return [];
  }
}

function getTierDiscount(tiers: { min_qty: number; descuento_pct: number }[], qty: number): number {
  const applicable = tiers.filter((t) => qty >= t.min_qty).sort((a, b) => b.min_qty - a.min_qty);
  return applicable[0]?.descuento_pct ?? 0;
}

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

    const priceTiers = await getTiersFromDB();

    // Precio SIEMPRE desde la base — nunca confiar en el unitPrice del cliente
    const itemsWithPrice = body.items.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId)!;
      const basePrice = Number(variant.price);
      const pct = getTierDiscount(priceTiers, item.quantity);
      const effectivePrice = pct > 0 ? basePrice * (1 - pct / 100) : basePrice;
      return { ...item, effectivePrice };
    });

    const subtotal = itemsWithPrice.reduce((acc, i) => acc + i.effectivePrice * i.quantity, 0);
    const total = subtotal;

    const order = await prisma.order.create({
      data: {
        userId: session?.user?.id ?? null,
        guestEmail: body.guestEmail ?? null,
        shippingAddress: body.shippingAddress,
        notes: body.notes,
        subtotal: subtotal.toString(),
        total: total.toString(),
        items: {
          create: itemsWithPrice.map((item) => ({
            variantId: item.variantId,
            productId: variants.find((v) => v.id === item.variantId)!.productId,
            quantity: item.quantity,
            unitPrice: item.effectivePrice.toString(),
            subtotal: (item.effectivePrice * item.quantity).toString(),
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
