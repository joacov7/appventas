export const dynamic = "force-dynamic";
export const maxDuration = 60; // la respuesta por voz (transcribir+sintetizar) tarda más

import { NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage, responderMensajeVoz, sendWhatsAppMessage } from "@/lib/whatsapp-bot";
import { procesarAudioEntrante } from "@/lib/whatsapp-voice";
import { loadWhatsAppConfig } from "@/lib/whatsapp-config";

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

    if (!value?.messages?.length) {
      // Could be a status update — acknowledge and ignore
      return NextResponse.json({ status: "ok" });
    }

    for (const message of value.messages) {
      const waId = message.from; // phone number

      // Nota de voz → respondemos también con audio (voz→texto→bot→voz).
      if (message.type === "audio" && message.audio?.id) {
        try {
          const r = await procesarAudioEntrante(waId, message.audio.id, responderMensajeVoz);
          // Si el pipeline de voz falla, respondemos por TEXTO igual: si ya
          // tenemos la respuesta calculada la mandamos, si no, un aviso corto.
          if (!r.ok) {
            const fallback = r.respuesta ?? "¡Hola! 👋 Recibí tu audio pero no lo pude escuchar bien. ¿Me lo escribís?";
            await sendWhatsAppMessage(waId, fallback);
          }
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
    }

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("[WA Webhook] Error:", e);
    return NextResponse.json({ status: "error" }, { status: 200 }); // always 200 to Meta
  }
}
