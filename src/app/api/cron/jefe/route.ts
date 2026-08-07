export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { armarBriefingProactivo } from "@/lib/agents/jefe-proactivo";
import { enviarAlertaTelegram, loadTelegramConfig } from "@/lib/telegram";

// Cron: el jefe de gabinete arma el reporte del día y te lo manda por Telegram.
export async function GET() {
  const cfg = await loadTelegramConfig();
  if (!cfg.botToken || !cfg.chatId) {
    return NextResponse.json({ ok: false, motivo: "Telegram no configurado" });
  }
  try {
    const texto = await armarBriefingProactivo();
    if (!texto) return NextResponse.json({ ok: true, enviado: false, motivo: "Sin novedades para reportar" });
    const enviado = await enviarAlertaTelegram(texto);
    return NextResponse.json({ ok: true, enviado });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
