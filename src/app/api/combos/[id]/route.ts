export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT c.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ci.id,
              'product_id', ci.product_id,
              'variant_id', ci.variant_id,
              'quantity', ci.quantity
            ) ORDER BY ci.id
          ) FILTER (WHERE ci.id IS NOT NULL), '[]'
        ) as items
      FROM combos c
      LEFT JOIN combo_items ci ON ci.combo_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, id);
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { name, slug, description, image_urls, active, precio_venta, precio_manual, items } = body;
  try {
    await (prisma as any).$executeRawUnsafe(`
      UPDATE combos SET
        name = $1, slug = $2, description = $3, image_urls = $4::jsonb,
        active = $5, precio_venta = $6, precio_manual = $7, updated_at = NOW()
      WHERE id = $8
    `, name, slug, description ?? null, JSON.stringify(image_urls ?? []), active ?? true, precio_venta ?? null, precio_manual ?? false, id);

    // Replace items
    await (prisma as any).$executeRawUnsafe(`DELETE FROM combo_items WHERE combo_id = $1`, id);
    if (items?.length) {
      for (const item of items) {
        await (prisma as any).$executeRawUnsafe(`
          INSERT INTO combo_items (combo_id, product_id, variant_id, quantity)
          VALUES ($1, $2, $3, $4)
        `, id, item.product_id, item.variant_id ?? null, item.quantity ?? 1);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  try {
    await (prisma as any).$executeRawUnsafe(`DELETE FROM combos WHERE id = $1`, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
