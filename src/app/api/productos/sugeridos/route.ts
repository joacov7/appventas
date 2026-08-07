import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/productos/sugeridos?exclude=id1,id2&categoryId=xxx&limit=3
// Returns active products NOT in the cart, preferring same category, then featured.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const excludeIds = (searchParams.get("exclude") ?? "").split(",").filter(Boolean);
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 3), 6);

  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        id: { notIn: excludeIds.length ? excludeIds : ["__none__"] },
        variants: { some: { active: true, stock: { gt: 0 } } },
        ...(categoryId && { categoryId }),
      },
      include: {
        variants: {
          where: { active: true, stock: { gt: 0 } },
          orderBy: { price: "asc" },
          take: 1,
        },
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    // If not enough same-category products, fill with featured from any category
    if (products.length < limit && categoryId) {
      const alreadyIds = [...excludeIds, ...products.map((p) => p.id)];
      const extra = await prisma.product.findMany({
        where: {
          active: true,
          id: { notIn: alreadyIds },
          variants: { some: { active: true, stock: { gt: 0 } } },
        },
        include: {
          variants: {
            where: { active: true, stock: { gt: 0 } },
            orderBy: { price: "asc" },
            take: 1,
          },
        },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        take: limit - products.length,
      });
      products.push(...extra);
    }

    return NextResponse.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        imageUrl: p.imageUrls[0] ?? p.variants[0]?.imageUrl ?? null,
        variantId: p.variants[0]?.id ?? null,
        variantName: p.variants[0]?.name ?? null,
        price: p.variants[0] ? Number(p.variants[0].price) : null,
        stock: p.variants[0]?.stock ?? 0,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
