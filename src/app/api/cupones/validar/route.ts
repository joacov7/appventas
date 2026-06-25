import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { code, subtotal } = await req.json();
  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });

  try {
    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });

    if (!coupon || !coupon.active) {
      return NextResponse.json({ error: "Código inválido" }, { status: 404 });
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ error: "Código vencido" }, { status: 400 });
    }
    if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
      return NextResponse.json({ error: "Código agotado" }, { status: 400 });
    }
    if (coupon.minAmount && subtotal < Number(coupon.minAmount)) {
      return NextResponse.json({
        error: `Monto mínimo $${Number(coupon.minAmount).toLocaleString("es-AR")}`,
      }, { status: 400 });
    }

    const discount = coupon.type === "PERCENT"
      ? (subtotal * Number(coupon.value)) / 100
      : Math.min(Number(coupon.value), subtotal);

    return NextResponse.json({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discount: Math.round(discount),
    });
  } catch {
    return NextResponse.json({ error: "Error al validar" }, { status: 500 });
  }
}
