export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { sendReactivationEmail } from "@/lib/emails";

async function getOrCreateReactivationCoupon(): Promise<string> {
  const existing = await prisma.coupon.findFirst({
    where: { code: "TEVOLVEMOS15", active: true },
  });
  if (existing) return existing.code;
  const coupon = await prisma.coupon.create({
    data: { code: "TEVOLVEMOS15", type: "PERCENT", value: 15, active: true },
  });
  return coupon.code;
}

// POST — trigger reactivation campaign (admin-only, can also be called by cron)
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const adminOk = await isAdmin();

  if (!adminOk && (!secret || auth !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }

  // Find guest emails that bought 30-90 days ago and haven't bought since
  const inactiveCustomers = await prisma.$queryRaw<{ email: string; lastOrder: Date }[]>`
    SELECT "guestEmail" AS email, MAX("createdAt") AS "lastOrder"
    FROM orders
    WHERE "guestEmail" IS NOT NULL
      AND "guestEmail" != ''
      AND status = 'PAID'
    GROUP BY "guestEmail"
    HAVING MAX("createdAt") BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '30 days'
    LIMIT 100
  `;

  if (inactiveCustomers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No hay clientes inactivos" });
  }

  const couponCode = await getOrCreateReactivationCoupon();
  let sent = 0;

  for (const customer of inactiveCustomers) {
    try {
      await sendReactivationEmail({ email: customer.email, couponCode, daysSinceOrder: 30 });
      sent++;
    } catch (e) {
      console.error(`Error sending reactivation to ${customer.email}:`, e);
    }
  }

  return NextResponse.json({ ok: true, sent, total: inactiveCustomers.length });
}
