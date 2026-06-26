import { isAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
    });
    return NextResponse.json(slides);
  } catch {
    return NextResponse.json([]);
  }
}

const schema = z.object({
  imageUrl: z.string().min(1),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  buttonUrl: z.string().optional(),
  position: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  try {
    const body = schema.parse(await req.json());
    const slide = await prisma.heroSlide.create({ data: body });
    return NextResponse.json(slide, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: "Error al crear slide", detail: String(error) }, { status: 500 });
  }
}
