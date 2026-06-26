import { isAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(coupons);
}

const schema = z.object({
  code: z.string().min(1).transform((s) => s.toUpperCase()),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive(),
  minAmount: z.number().optional(),
  maxUses: z.number().int().optional(),
  expiresAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  try {
    const body = schema.parse(await req.json());
    const coupon = await prisma.coupon.create({
      data: { ...body, expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: "Error al crear cupón", detail: String(error) }, { status: 500 });
  }
}
