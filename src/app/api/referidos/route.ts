export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS referidos (
      id          SERIAL PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      codigo      TEXT NOT NULL UNIQUE,
      usos        INT NOT NULL DEFAULT 0,
      activo      BOOLEAN NOT NULL DEFAULT true,
      creado_en   TIMESTAMPTZ DEFAULT now()
    )
  `);
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS referido_usos (
      id              SERIAL PRIMARY KEY,
      codigo          TEXT NOT NULL,
      email_comprador TEXT,
      order_id        TEXT,
      descuento_pct   NUMERIC(5,2),
      creado_en       TIMESTAMPTZ DEFAULT now()
    )
  `);
}

function generateCode(email: string): string {
  const base = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `REF-${base}${rand}`;
}

// POST /api/referidos — get or create referral code for an email
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

  await ensureTable();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await (prisma as any).$queryRawUnsafe(
    `SELECT id, codigo, usos FROM referidos WHERE email = $1`,
    normalizedEmail
  );

  if (existing.length > 0) {
    return NextResponse.json({ codigo: existing[0].codigo, usos: existing[0].usos });
  }

  let codigo = generateCode(normalizedEmail);
  // Ensure uniqueness
  const conflict = await (prisma as any).$queryRawUnsafe(
    `SELECT id FROM referidos WHERE codigo = $1`, codigo
  );
  if (conflict.length > 0) codigo = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO referidos (email, codigo) VALUES ($1, $2)`,
    normalizedEmail, codigo
  );

  return NextResponse.json({ codigo, usos: 0 });
}

// GET /api/referidos?codigo=XXX — validate a referral code
export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get("codigo");

  if (!codigo) {
    // Admin list
    if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
    await ensureTable();
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT r.id, r.email, r.codigo, r.usos, r.activo, r.creado_en,
              COALESCE(SUM(ru.descuento_pct), 0)::float AS total_descuentos_otorgados
       FROM referidos r
       LEFT JOIN referido_usos ru ON ru.codigo = r.codigo
       GROUP BY r.id ORDER BY r.usos DESC LIMIT 100`
    );
    return NextResponse.json(rows);
  }

  await ensureTable();
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT id, email, codigo, usos, activo FROM referidos WHERE codigo = $1`,
    codigo.toUpperCase()
  );

  if (!rows.length || !rows[0].activo) {
    return NextResponse.json({ valid: false });
  }

  const descuentoPct = Number(process.env.REFERIDOS_DESCUENTO_PCT ?? 10);
  return NextResponse.json({ valid: true, codigo: rows[0].codigo, descuentoPct });
}

// PATCH /api/referidos — register a use (called after order created)
export async function PATCH(req: NextRequest) {
  const { codigo, emailComprador, orderId } = await req.json();
  if (!codigo) return NextResponse.json({ error: "codigo requerido" }, { status: 400 });

  await ensureTable();
  const descuentoPct = Number(process.env.REFERIDOS_DESCUENTO_PCT ?? 10);

  await (prisma as any).$executeRawUnsafe(
    `UPDATE referidos SET usos = usos + 1 WHERE codigo = $1`, codigo
  );
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO referido_usos (codigo, email_comprador, order_id, descuento_pct) VALUES ($1, $2, $3, $4)`,
    codigo, emailComprador ?? null, orderId ?? null, descuentoPct
  );

  // Notify referrer
  const referrer = await (prisma as any).$queryRawUnsafe(
    `SELECT email FROM referidos WHERE codigo = $1`, codigo
  );
  if (referrer.length > 0) {
    const { sendReferralNotification } = await import("@/lib/emails");
    sendReferralNotification({ referrerEmail: referrer[0].email, codigo }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
