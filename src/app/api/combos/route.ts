export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";

async function ensureTables() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS combos (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      image_urls JSONB DEFAULT '[]',
      active BOOLEAN DEFAULT TRUE,
      precio_venta DECIMAL(12,2),
      precio_manual BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS combo_items (
      id SERIAL PRIMARY KEY,
      combo_id TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 1
    )
  `);
}

export async function GET() {
  try {
    await ensureTables();
    const combos: any[] = await (prisma as any).$queryRawUnsafe(`
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
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return NextResponse.json(combos);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = await req.json();
  const { name, slug, description, image_urls, active, precio_venta, precio_manual, items } = body;
  try {
    await ensureTables();
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO combos (name, slug, description, image_urls, active, precio_venta, precio_manual)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      RETURNING id
    `, name, slug, description ?? null, JSON.stringify(image_urls ?? []), active ?? true, precio_venta ?? null, precio_manual ?? false);
    const id = rows[0].id;

    if (items?.length) {
      for (const item of items) {
        await (prisma as any).$executeRawUnsafe(`
          INSERT INTO combo_items (combo_id, product_id, variant_id, quantity)
          VALUES ($1, $2, $3, $4)
        `, id, item.product_id, item.variant_id ?? null, item.quantity ?? 1);
      }
    }

    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
