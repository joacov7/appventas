export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const KEY = "pricing_config";

export const DEFAULT_PRICING_CONFIG = {
  margenes: {
    minorista: 45,
    mayorista: 25,
    distribuidor: 15,
  },
  mediosPago: {
    efectivo: 0,
    transferencia: 0,
    debito: 1.5,
    credito1: 3.5,
    credito3: 8,
    credito6: 15,
    mercadoPago: 5.99,
    echeq: 2,
  },
};

export async function GET() {
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, KEY
    );
    const saved = rows[0]?.config ?? {};
    // Deep merge with defaults so new keys always exist
    return NextResponse.json({
      margenes: { ...DEFAULT_PRICING_CONFIG.margenes, ...(saved.margenes ?? {}) },
      mediosPago: { ...DEFAULT_PRICING_CONFIG.mediosPago, ...(saved.mediosPago ?? {}) },
    });
  } catch {
    return NextResponse.json(DEFAULT_PRICING_CONFIG);
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = await req.json();
  try {
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO catalog_config (tipo, config)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()
    `, KEY, JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
