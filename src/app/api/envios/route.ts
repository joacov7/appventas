import { isAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  try {
    const options = await prisma.shippingOption.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { price: "asc" }],
    });
    return NextResponse.json(options);
  } catch {
    return NextResponse.json([]);
  }
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  estimatedDays: z.string().optional(),
  position: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  try {
    const body = schema.parse(await req.json());
    const option = await prisma.shippingOption.create({ data: body });
    return NextResponse.json(option, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: "Error al crear opción", detail: String(error) }, { status: 500 });
  }
}
