import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  items: z.array(
    z.object({ variantId: z.string(), quantity: z.number().int().positive() })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const { items } = schema.parse(await req.json());
    const ids = items.map((i) => i.variantId);

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: ids }, active: true },
      select: { id: true, stock: true, name: true, price: true },
    });

    const errors: string[] = [];
    const updated = items.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId);
      if (!variant) {
        errors.push(`Variante ${item.variantId} no disponible`);
        return { ...item, available: false };
      }
      if (variant.stock < item.quantity) {
        errors.push(
          `"${variant.name}": stock disponible ${variant.stock} (pediste ${item.quantity})`
        );
        return { ...item, available: false, availableStock: variant.stock };
      }
      return {
        ...item,
        available: true,
        currentPrice: Number(variant.price),
      };
    });

    return NextResponse.json({ valid: errors.length === 0, errors, items: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error de validación" }, { status: 500 });
  }
}
