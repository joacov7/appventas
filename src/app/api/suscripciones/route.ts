export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS suscripciones_reposicion (
      id               SERIAL PRIMARY KEY,
      email            TEXT NOT NULL,
      variant_id       TEXT NOT NULL,
      product_name     TEXT NOT NULL,
      variant_name     TEXT NOT NULL,
      product_slug     TEXT NOT NULL,
      quantity         INT NOT NULL DEFAULT 1,
      frecuencia_dias  INT NOT NULL DEFAULT 30,
      proximo_envio    DATE NOT NULL,
      ultimo_envio     DATE,
      estado           TEXT NOT NULL DEFAULT 'activa',
      creado_en        TIMESTAMPTZ DEFAULT now(),
      UNIQUE (email, variant_id)
    )
  `);
}

// POST — subscribe (store)
export async function POST(req: NextRequest) {
  const { email, variantId, productName, variantName, productSlug, quantity, frecuenciaDias } = await req.json();
  if (!email?.trim() || !variantId) {
    return NextResponse.json({ error: "email y variantId requeridos" }, { status: 400 });
  }

  await ensureTable();
  const normalizedEmail = email.trim().toLowerCase();

  const proximoEnvio = new Date();
  proximoEnvio.setDate(proximoEnvio.getDate() + Number(frecuenciaDias ?? 30));

  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO suscripciones_reposicion
       (email, variant_id, product_name, variant_name, product_slug, quantity, frecuencia_dias, proximo_envio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date)
     ON CONFLICT (email, variant_id) DO UPDATE
       SET quantity = $6, frecuencia_dias = $7, proximo_envio = $8::date, estado = 'activa'`,
    normalizedEmail, variantId, productName, variantName, productSlug,
    Number(quantity ?? 1), Number(frecuenciaDias ?? 30), proximoEnvio.toISOString().slice(0, 10)
  );

  return NextResponse.json({ ok: true });
}

// GET — admin list
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();

  const [rows, resumen] = await Promise.all([
    (prisma as any).$queryRawUnsafe(`
      SELECT id, email, product_name, variant_name, quantity, frecuencia_dias,
             proximo_envio::text, ultimo_envio::text, estado, creado_en
      FROM suscripciones_reposicion
      ORDER BY proximo_envio ASC LIMIT 200
    `),
    (prisma as any).$queryRawUnsafe(`
      SELECT estado, COUNT(*)::int AS cantidad FROM suscripciones_reposicion GROUP BY estado
    `),
  ]);

  return NextResponse.json({ suscripciones: rows, resumen });
}

// PATCH — cancel (by customer token or admin)
export async function PATCH(req: NextRequest) {
  const { id, estado } = await req.json();
  await ensureTable();
  await (prisma as any).$executeRawUnsafe(
    `UPDATE suscripciones_reposicion SET estado = $2 WHERE id = $1`,
    id, estado ?? "cancelada"
  );
  return NextResponse.json({ ok: true });
}
