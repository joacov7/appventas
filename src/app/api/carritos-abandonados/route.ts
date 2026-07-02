import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS carritos_abandonados (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL,
      items_json JSONB NOT NULL,
      total      NUMERIC(12,2) NOT NULL,
      estado     TEXT NOT NULL DEFAULT 'pendiente',
      email_2h_en   TIMESTAMPTZ,
      email_24h_en  TIMESTAMPTZ,
      creado_en  TIMESTAMPTZ DEFAULT now(),
      actualizado_en TIMESTAMPTZ DEFAULT now()
    )
  `);
  await (prisma as any).$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_carritos_email ON carritos_abandonados(email);
    CREATE INDEX IF NOT EXISTS idx_carritos_estado ON carritos_abandonados(estado);
  `);
}

// POST — registrar o actualizar carrito abandonado
export async function POST(req: NextRequest) {
  const { email, items, total } = await req.json();
  if (!email?.trim() || !items?.length) {
    return NextResponse.json({ error: "email e items requeridos" }, { status: 400 });
  }

  await ensureTable();

  // Si ya existe un carrito pendiente para este email, actualizar en lugar de duplicar
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO carritos_abandonados (email, items_json, total, estado)
     VALUES ($1, $2::jsonb, $3, 'pendiente')
     ON CONFLICT DO NOTHING`,
    email.trim().toLowerCase(), JSON.stringify(items), Number(total)
  );

  // Upsert: si ya había uno pendiente para este email, actualizarlo
  await (prisma as any).$executeRawUnsafe(
    `UPDATE carritos_abandonados
     SET items_json = $2::jsonb, total = $3, actualizado_en = now()
     WHERE email = $1 AND estado = 'pendiente'`,
    email.trim().toLowerCase(), JSON.stringify(items), Number(total)
  );

  return NextResponse.json({ ok: true });
}

// PATCH — marcar como convertido cuando el usuario compra
export async function PATCH(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "email requerido" }, { status: 400 });
  await ensureTable();
  await (prisma as any).$executeRawUnsafe(
    `UPDATE carritos_abandonados SET estado = 'convertido', actualizado_en = now()
     WHERE email = $1 AND estado IN ('pendiente', 'email_2h')`,
    email.trim().toLowerCase()
  );
  return NextResponse.json({ ok: true });
}

// GET — estadísticas para el admin
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT estado, COUNT(*)::int as cantidad, SUM(total)::numeric as total
     FROM carritos_abandonados
     GROUP BY estado ORDER BY estado`
  );
  const recientes = await (prisma as any).$queryRawUnsafe(
    `SELECT id, email, total, estado, creado_en
     FROM carritos_abandonados
     ORDER BY creado_en DESC LIMIT 20`
  );
  return NextResponse.json({ resumen: rows, recientes });
}
