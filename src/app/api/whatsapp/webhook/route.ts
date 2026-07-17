export const dynamic = "force-dynamic";
export const maxDuration = 60; // la respuesta por voz (transcribir+sintetizar) tarda más

import { NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage, responderMensajeVoz, sendWhatsAppMessage } from "@/lib/whatsapp-bot";
import { procesarAudioEntrante } from "@/lib/whatsapp-voice";
import { alertaNuevoWhatsapp } from "@/lib/telegram";
import { avisarPendientes } from "@/lib/services/whatsapp-pendientes.service";
import { loadWhatsAppConfig } from "@/lib/whatsapp-config";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Rango de estados: no permitimos "bajar" (read no vuelve a delivered si el
// evento llega desordenado). failed se registra siempre.
const RANGO: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

async function registrarEstados(statuses: any[]): Promise<void> {
  await ensureSchema("whatsapp");
  for (const s of statuses) {
    const id = s?.id;
    const estado = s?.status;
    if (!id || !estado) continue;
    if (estado === "failed") {
      await (prisma as any).$executeRawUnsafe(
        `UPDATE whatsapp_mensajes SET estado = 'failed' WHERE wam_id = $1`, id).catch(() => {});
      continue;
    }
    const rango = RANGO[estado];
    if (!rango) continue;
    // Solo sube de nivel (evita read → delivered por eventos fuera de orden).
    await (prisma as any).$executeRawUnsafe(
      `UPDATE whatsapp_mensajes SET estado = $2 WHERE wam_id = $1
         AND COALESCE(CASE estado WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END, 0) < $3`,
      id, estado, rango).catch(() => {});
  }
}

// ── GET — Meta webhook verification ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const { verifyToken } = await loadWhatsAppConfig();
  if (!verifyToken) {
    return new NextResponse("Verify token no configurado", { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Verification failed", { status: 403 });
}

// ── POST — receive messages ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Meta sends updates in this structure
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Actualizaciones de estado de entrega (sent → delivered → read → failed).
    if (value?.statuses?.length) {
      await registrarEstados(value.statuses).catch(() => {});
      return NextResponse.json({ status: "ok" });
    }

    if (!value?.messages?.length) {
      return NextResponse.json({ status: "ok" });
    }

    for (const message of value.messages) {
      const waId = message.from; // phone number

      // Nota de voz → respondemos también con audio (voz→texto→bot→voz).
      if (message.type === "audio" && message.audio?.id) {
        try {
          const r = await procesarAudioEntrante(waId, message.audio.id, responderMensajeVoz);
          if (!r.ok) {
            const fallback = r.respuesta ?? "¡Hola! 👋 Recibí tu audio pero no lo pude escuchar bien. ¿Me lo escribís?";
            await sendWhatsAppMessage(waId, fallback);
          }
          await alertaNuevoWhatsapp(waId, r.transcripcion ?? "(no se pudo transcribir)", true);
        } catch (e) {
          console.error("[WA Bot] audio error:", e);
        }
        continue;
      }

      if (message.type !== "text") continue; // otros tipos: ignorar por ahora
      const text = message.text?.body ?? "";
      if (!text) continue;

      // IMPORTANTE: esperar el procesamiento. En serverless (Vercel) la función
      // se congela al responder y mataría el envío de la respuesta a Meta.
      try {
        await handleIncomingMessage(waId, text);
      } catch (e) {
        console.error("[WA Bot] handleIncomingMessage error:", e);
      }
      // Aviso al dueño por Telegram (no bloquea si falla).
      await alertaNuevoWhatsapp(waId, text).catch(() => {});
      // Aprovecha el tráfico para recordar OTRAS charlas viejas sin responder
      // (las de hace +45min; la actual queda excluida por ser reciente).
      await avisarPendientes().catch(() => {});
    }

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("[WA Webhook] Error:", e);
    return NextResponse.json({ status: "error" }, { status: 200 }); // always 200 to Meta
  }
}
