export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReposicionEmail } from "@/lib/emails";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const due = await (prisma as any).$queryRawUnsafe(`
    SELECT id, email, product_name, variant_name, product_slug, quantity, frecuencia_dias
    FROM suscripciones_reposicion
    WHERE estado = 'activa' AND proximo_envio <= CURRENT_DATE
    LIMIT 100
  `);

  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://appventas-iota.vercel.app";

  for (const sub of due) {
    try {
      const buyLink = `${appUrl}/producto/${sub.product_slug}`;
      await sendReposicionEmail({
        email: sub.email,
        productName: sub.product_name,
        variantName: sub.variant_name,
        quantity: sub.quantity,
        frecuenciaDias: sub.frecuencia_dias,
        buyLink,
      });

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + Number(sub.frecuencia_dias));

      await (prisma as any).$executeRawUnsafe(
        `UPDATE suscripciones_reposicion
         SET ultimo_envio = CURRENT_DATE, proximo_envio = $2::date
         WHERE id = $1`,
        sub.id, nextDate.toISOString().slice(0, 10)
      );
      sent++;
    } catch (e) {
      console.error(`Error sending reposicion to ${sub.email}:`, e);
    }
  }

  return NextResponse.json({ ok: true, sent, total: due.length });
}
