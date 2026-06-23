import { NextRequest, NextResponse } from "next/server";
import { getMpPayment } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";
import type { TransactionStatus, OrderStatus } from "@prisma/client";

// Mapeo de estados MP → estados internos
const MP_STATUS_MAP: Record<string, TransactionStatus> = {
  approved: "APPROVED",
  pending: "PENDING",
  in_process: "IN_PROCESS",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
};

const ORDER_STATUS_MAP: Record<TransactionStatus, OrderStatus> = {
  APPROVED: "PROCESSING",
  PENDING: "PENDING",
  IN_PROCESS: "PENDING",
  REJECTED: "PENDING",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
};

function verifyWebhookSignature(req: NextRequest, rawBody: string): boolean {
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  if (!webhookSecret) return true; // en dev sin secret configurado

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const dataId = req.nextUrl.searchParams.get("data.id");

  if (!xSignature) return false;

  const parts = xSignature.split(",");
  const tsEntry = parts.find((p) => p.startsWith("ts="));
  const v1Entry = parts.find((p) => p.startsWith("v1="));
  if (!tsEntry || !v1Entry) return false;

  const ts = tsEntry.split("=")[1];
  const v1 = v1Entry.split("=")[1];

  const signedTemplate = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = createHmac("sha256", webhookSecret)
    .update(signedTemplate)
    .digest("hex");

  return hmac === v1;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyWebhookSignature(req, rawBody)) {
      console.warn("[WEBHOOK] Firma inválida");
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { type, data } = body;

    // Solo procesamos notificaciones de pagos
    if (type !== "payment") {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id as string;
    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID faltante" }, { status: 400 });
    }

    // Consultar el pago en MP para obtener el estado real
    const payment = await getMpPayment().get({ id: paymentId });

    const mpStatus = payment.status ?? "pending";
    const externalRef = payment.external_reference;

    if (!externalRef) {
      console.error("[WEBHOOK] Sin external_reference en pago", paymentId);
      return NextResponse.json({ received: true });
    }

    const transactionStatus: TransactionStatus =
      MP_STATUS_MAP[mpStatus] ?? "PENDING";
    const orderStatus: OrderStatus = ORDER_STATUS_MAP[transactionStatus];

    // Actualizar transacción y orden en una transacción atómica
    await prisma.$transaction([
      prisma.transaction.upsert({
        where: { mpPaymentId: String(paymentId) },
        create: {
          orderId: externalRef,
          mpPaymentId: String(paymentId),
          mpExternalRef: externalRef,
          status: transactionStatus,
          statusDetail: payment.status_detail ?? null,
          paymentMethodId: payment.payment_method_id ?? null,
          paymentTypeId: payment.payment_type_id ?? null,
          amount: payment.transaction_amount
            ? String(payment.transaction_amount)
            : null,
          rawResponse: payment as object,
        },
        update: {
          status: transactionStatus,
          statusDetail: payment.status_detail ?? null,
          rawResponse: payment as object,
        },
      }),
      prisma.order.update({
        where: { id: externalRef },
        data: { status: orderStatus },
      }),
    ]);

    // Si el pago fue aprobado, decrementar stock
    if (transactionStatus === "APPROVED") {
      const order = await prisma.order.findUnique({
        where: { id: externalRef },
        include: { items: true },
      });

      if (order) {
        await Promise.all(
          order.items.map((item) =>
            prisma.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { decrement: item.quantity } },
            })
          )
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[WEBHOOK_ERROR]", error);
    // Siempre devolver 200 para que MP no reintente indefinidamente
    return NextResponse.json({ received: true });
  }
}
