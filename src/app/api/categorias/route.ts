import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json([]);
  }
}

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  }
  try {
    const body = schema.parse(await req.json());
    const category = await prisma.category.create({ data: body });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al crear categoría" }, { status: 500 });
  }
}
