import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/emails";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS suscriptores_newsletter (
      id          SERIAL PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      nombre      TEXT,
      estado      TEXT NOT NULL DEFAULT 'activo',
      cupon_code  TEXT,
      creado_en   TIMESTAMPTZ DEFAULT now(),
      baja_en     TIMESTAMPTZ
    )
  `);
}

async function getOrCreateWelcomeCoupon(): Promise<string> {
  // Look for existing welcome coupon
  const existing = await prisma.coupon.findFirst({
    where: { code: { startsWith: "BIENVENIDO" }, active: true },
  });
  if (existing) return existing.code;

  // Create a 10% welcome coupon
  const coupon = await prisma.coupon.create({
    data: {
      code: "BIENVENIDO10",
      type: "PERCENT",
      value: 10,
      active: true,
    },
  });
  return coupon.code;
}

export async function POST(req: NextRequest) {
  const { email, nombre } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();

  await ensureTable();

  // Check if already subscribed
  const existing = await (prisma as any).$queryRawUnsafe(
    `SELECT id, estado FROM suscriptores_newsletter WHERE email = $1`,
    normalizedEmail
  );
  if (existing.length > 0 && existing[0].estado === "activo") {
    return NextResponse.json({ ok: true, alreadySubscribed: true });
  }

  const couponCode = await getOrCreateWelcomeCoupon();

  if (existing.length > 0) {
    // Re-subscribe
    await (prisma as any).$executeRawUnsafe(
      `UPDATE suscriptores_newsletter SET estado = 'activo', nombre = $2, cupon_code = $3, baja_en = NULL WHERE email = $1`,
      normalizedEmail, nombre ?? null, couponCode
    );
  } else {
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO suscriptores_newsletter (email, nombre, cupon_code) VALUES ($1, $2, $3)`,
      normalizedEmail, nombre ?? null, couponCode
    );
  }

  // Send welcome email (non-blocking)
  sendWelcomeEmail({ email: normalizedEmail, nombre: nombre ?? null, couponCode }).catch(console.error);

  return NextResponse.json({ ok: true, couponCode });
}
