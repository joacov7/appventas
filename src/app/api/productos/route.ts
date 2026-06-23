import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const search = searchParams.get("search");

  const products = await prisma.product.findMany({
    where: {
      active: true,
      ...(category && { category: { slug: category } }),
      ...(featured === "true" && { featured: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        where: { active: true },
        orderBy: { price: "asc" },
      },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(products);
}

const variantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  imageUrl: z.string().url().optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  imageUrls: z.array(z.string()).default([]),
  categoryId: z.string().optional(),
  featured: z.boolean().default(false),
  variants: z.array(variantSchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  }

  try {
    const body = createProductSchema.parse(await req.json());
    const product = await prisma.product.create({
      data: {
        ...body,
        variants: { create: body.variants },
      },
      include: { variants: true, category: true },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}
