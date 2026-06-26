import { isAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  estimatedDays: z.string().optional(),
  active: z.boolean().optional(),
  position: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  const { id } = await params;
  try {
    const body = schema.parse(await req.json());
    const option = await prisma.shippingOption.update({ where: { id }, data: body });
    return NextResponse.json(option);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: "Error al actualizar", detail: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  const { id } = await params;
  await prisma.shippingOption.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
