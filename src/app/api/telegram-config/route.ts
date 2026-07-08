export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadTelegramConfig, saveTelegramConfig, enviarAlertaTelegram, configurarWebhookTelegram } from "@/lib/telegram";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://appventas-iota.vercel.app";

// Devuelve la config con el token enmascarado (no se expone completo).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const c = await loadTelegramConfig();
  return NextResponse.json({
    botToken: c.botToken ? c.botToken.slice(0, 6) + "••••••" : "",
    chatId: c.chatId,
    configurado: !!(c.botToken && c.chatId),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { botToken, chatId, test } = await req.json();

  // Prueba de envío sin guardar cambios (usa lo guardado).
  if (test) {
    const ok = await enviarAlertaTelegram("✅ <b>Prueba de AppVentas</b>\nSi ves este mensaje, los avisos por Telegram están funcionando.");
    return NextResponse.json({ ok });
  }

  if (!botToken?.trim() || !chatId?.trim()) {
    return NextResponse.json({ error: "Bot Token y Chat ID son obligatorios" }, { status: 400 });
  }
  // Si el token viene enmascarado (no lo tocaron), conservamos el guardado.
  const actual = await loadTelegramConfig();
  const tokenFinal = botToken.includes("••") ? actual.botToken : botToken.trim();
  await saveTelegramConfig({ botToken: tokenFinal, chatId: chatId.trim(), secret: actual.secret });
  // Activa el puente de 2 vías (recibir tus respuestas desde Telegram).
  const webhookOk = await configurarWebhookTelegram(APP_URL);
  return NextResponse.json({ ok: true, webhookOk });
}
