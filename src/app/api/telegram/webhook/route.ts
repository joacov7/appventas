export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import {
  loadTelegramConfig, waIdDesdeTextoAlerta, enviarAlertaTelegram,
  guardarPendiente, cargarPendiente, limpiarPendiente,
} from "@/lib/telegram";
import { enviarWhatsapp } from "@/lib/services/whatsapp.service";
import { registry } from "@/lib/tools";
import { jefeDeGabinete } from "@/lib/agents/jefe";

const AFIRMATIVO = /^(s[ií]|ok|dale|mand[aá]|confirmo|envi[aá]|correcto|👍)/i;
const NEGATIVO = /^(no|cancel|cancelar|olvid|dej[aá])/i;

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

    const chatId = String(message.chat?.id ?? "");
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

    // CASO 2: hay una acción esperando tu confirmación (propuesta por el jefe).
    const pendiente = await cargarPendiente(chatId);
    if (pendiente) {
      if (NEGATIVO.test(texto)) {
        await limpiarPendiente(chatId);
        await enviarAlertaTelegram("👌 Cancelado, no mandé nada.");
        return NextResponse.json({ ok: true });
      }
      // "SÍ" → ejecuta tal cual; cualquier otro texto → lo usa como mensaje corregido.
      const input = AFIRMATIVO.test(texto) ? pendiente.input : { ...pendiente.input, texto };
      const res = await registry.execute(pendiente.tool, input);
      await limpiarPendiente(chatId);
      if (!res.ok) {
        await enviarAlertaTelegram(`⚠️ No se pudo ejecutar: ${res.error}`);
      } else if (res.output && typeof (res.output as any).texto === "string") {
        // Algunas acciones (ej. ejecutar_agente) devuelven su propio informe.
        await enviarAlertaTelegram((res.output as any).texto);
      } else {
        await enviarAlertaTelegram("✅ Hecho.");
      }
      return NextResponse.json({ ok: true });
    }

    // CASO 3: mensaje suelto → lo maneja el Jefe de Gabinete.
    const r = await jefeDeGabinete(texto);
    if (r.tipo === "confirmar") await guardarPendiente(chatId, r.accion);
    await enviarAlertaTelegram(r.texto);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // nunca romper ante Telegram
  }
}
