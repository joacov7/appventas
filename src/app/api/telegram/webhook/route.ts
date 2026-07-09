export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { loadTelegramConfig, waIdDesdeTextoAlerta, enviarAlertaTelegram } from "@/lib/telegram";
import { enviarWhatsapp } from "@/lib/services/whatsapp.service";
import { jefeDeGabinete } from "@/lib/agents/jefe";

// Recibe TUS mensajes de Telegram. Si respondés (citando) un aviso de WhatsApp,
// tu texto se le envía al cliente por WhatsApp. Puente de 2 vías.
export async function POST(req: NextRequest) {
  try {
    const cfg = await loadTelegramConfig();
    // Seguridad: Telegram manda el secret que registramos en setWebhook.
    const secret = req.headers.get("x-telegram-bot-api-secret-token");
    if (cfg.secret && secret !== cfg.secret) {
      return NextResponse.json({ ok: true }); // ignorar silenciosamente
    }

    const update = await req.json();
    const message = update?.message;
    const texto = message?.text?.trim();
    if (!message || !texto) return NextResponse.json({ ok: true });

    const citado = message.reply_to_message?.text as string | undefined;
    const waId = waIdDesdeTextoAlerta(citado);

    // CASO 1: respondés citando un aviso de WhatsApp → va al cliente.
    if (waId) {
      const r = await enviarWhatsapp(waId, texto);
      await enviarAlertaTelegram(
        r.enviado ? `✅ Enviado a ${waId}.` : `⚠️ No se pudo enviar a ${waId} (¿WhatsApp conectado?).`
      );
      return NextResponse.json({ ok: true });
    }

    // CASO 2: mensaje suelto (no cita un aviso) → lo maneja el Jefe de Gabinete.
    const respuesta = await jefeDeGabinete(texto);
    await enviarAlertaTelegram(respuesta);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // nunca romper ante Telegram
  }
}
