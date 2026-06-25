import { isAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: { select: { name: true, slug: true, imageUrls: true } },
          variant: { select: { name: true } },
        },
      },
      transactions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  // Solo el dueño o un admin pueden ver la orden
  if (order.userId && order.userId !== session?.user?.id && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  }

  return NextResponse.json(order);
}

const updateSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const { status } = updateSchema.parse(await req.json());
    const order = await prisma.order.update({ where: { id }, data: { status } });
    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al actualizar orden" }, { status: 500 });
  }
}
