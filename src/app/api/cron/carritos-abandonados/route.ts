import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAbandonedCartEmail } from "@/lib/emails";

async function findCouponForAbandoned(): Promise<string | undefined> {
  try {
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT code FROM "Coupon" WHERE active = true AND (uses_left IS NULL OR uses_left > 0)
       ORDER BY value DESC LIMIT 1`
    );
    return rows[0]?.code ?? undefined;
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  let sent2h = 0;
  let sent24h = 0;

  // Carts pending for >2h → send first reminder
  const pending2h = await (prisma as any).$queryRawUnsafe(`
    SELECT id, email, items_json, total::float
    FROM carritos_abandonados
    WHERE estado = 'pendiente'
      AND creado_en < NOW() - INTERVAL '2 hours'
      AND email_2h_en IS NULL
    LIMIT 50
  `);

  for (const cart of pending2h) {
    try {
      await sendAbandonedCartEmail({
        email: cart.email,
        items: cart.items_json,
        total: cart.total,
        etapa: "2h",
      });
      await (prisma as any).$executeRawUnsafe(
        `UPDATE carritos_abandonados
         SET estado = 'email_2h', email_2h_en = NOW(), actualizado_en = NOW()
         WHERE id = $1`,
        cart.id
      );
      sent2h++;
    } catch (e) {
      console.error(`Error sending 2h email to ${cart.email}:`, e);
    }
  }

  // Carts at email_2h for >24h → send final reminder with coupon
  const pending24h = await (prisma as any).$queryRawUnsafe(`
    SELECT id, email, items_json, total::float
    FROM carritos_abandonados
    WHERE estado = 'email_2h'
      AND creado_en < NOW() - INTERVAL '24 hours'
      AND email_24h_en IS NULL
    LIMIT 50
  `);

  const couponCode = pending24h.length > 0 ? await findCouponForAbandoned() : undefined;

  for (const cart of pending24h) {
    try {
      await sendAbandonedCartEmail({
        email: cart.email,
        items: cart.items_json,
        total: cart.total,
        etapa: "24h",
        couponCode,
      });
      await (prisma as any).$executeRawUnsafe(
        `UPDATE carritos_abandonados
         SET estado = 'email_24h', email_24h_en = NOW(), actualizado_en = NOW()
         WHERE id = $1`,
        cart.id
      );
      sent24h++;
    } catch (e) {
      console.error(`Error sending 24h email to ${cart.email}:`, e);
    }
  }

  return NextResponse.json({ ok: true, sent2h, sent24h, ts: now.toISOString() });
}
