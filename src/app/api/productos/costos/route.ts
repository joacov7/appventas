export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({});
  const idList = ids.split(",").filter(Boolean);
  if (!idList.length) return NextResponse.json({});

  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT product_id, costo FROM product_pricing
      WHERE product_id = ANY($1::text[])
    `, idList);

    const result: Record<string, number | null> = {};
    for (const id of idList) result[id] = null;
    for (const row of rows) result[row.product_id] = row.costo != null ? Number(row.costo) : null;

    return NextResponse.json(result);
  } catch {
    const result: Record<string, null> = {};
    for (const id of idList) result[id] = null;
    return NextResponse.json(result);
  }
}
