export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";

async function ensureTables() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS product_pricing (
      product_id TEXT PRIMARY KEY,
      costo DECIMAL(12,2),
      precio_minorista DECIMAL(12,2),
      precio_mayorista DECIMAL(12,2),
      precio_distribuidor DECIMAL(12,2),
      minorista_manual BOOLEAN DEFAULT FALSE,
      mayorista_manual BOOLEAN DEFAULT FALSE,
      distribuidor_manual BOOLEAN DEFAULT FALSE,
      precios_medios_pago JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      campo TEXT NOT NULL,
      valor_anterior DECIMAL(12,2),
      valor_nuevo DECIMAL(12,2),
      usuario TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await ensureTables();
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM product_pricing WHERE product_id = $1`, id
    );
    const history: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM price_history WHERE product_id = $1 ORDER BY created_at DESC LIMIT 20`, id
    );
    return NextResponse.json({ pricing: rows[0] ?? null, history });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  try {
    await ensureTables();

    const existing: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM product_pricing WHERE product_id = $1`, id
    );
    const prev = existing[0] ?? {};

    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO product_pricing (
        product_id, costo,
        precio_minorista, precio_mayorista, precio_distribuidor,
        minorista_manual, mayorista_manual, distribuidor_manual,
        precios_medios_pago, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW())
      ON CONFLICT (product_id) DO UPDATE SET
        costo = $2,
        precio_minorista = $3,
        precio_mayorista = $4,
        precio_distribuidor = $5,
        minorista_manual = $6,
        mayorista_manual = $7,
        distribuidor_manual = $8,
        precios_medios_pago = $9::jsonb,
        updated_at = NOW()
    `,
      id,
      body.costo ?? null,
      body.precio_minorista ?? null,
      body.precio_mayorista ?? null,
      body.precio_distribuidor ?? null,
      body.minorista_manual ?? false,
      body.mayorista_manual ?? false,
      body.distribuidor_manual ?? false,
      JSON.stringify(body.precios_medios_pago ?? {})
    );

    // Record history for changed fields
    const trackFields = ["costo", "precio_minorista", "precio_mayorista", "precio_distribuidor"] as const;
    for (const campo of trackFields) {
      const anterior = prev[campo] != null ? Number(prev[campo]) : null;
      const nuevo = body[campo] != null ? Number(body[campo]) : null;
      if (anterior !== nuevo) {
        await (prisma as any).$executeRawUnsafe(
          `INSERT INTO price_history (product_id, campo, valor_anterior, valor_nuevo) VALUES ($1,$2,$3,$4)`,
          id, campo, anterior, nuevo
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
