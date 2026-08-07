export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Características de un producto (para el catálogo premium). Una por línea.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await ensureSchema("premium");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT items FROM producto_caracteristicas WHERE product_id = $1`, id);
    const items = Array.isArray(rows[0]?.items) ? rows[0].items.map((x: any) => String(x)) : [];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const { items } = await req.json();
  const limpio = (Array.isArray(items) ? items : []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 12);
  await ensureSchema("premium");
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO producto_caracteristicas (product_id, items, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (product_id) DO UPDATE SET items = $2::jsonb, updated_at = NOW()`,
    id, JSON.stringify(limpio)
  );
  return NextResponse.json({ ok: true });
}
