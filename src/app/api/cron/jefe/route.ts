export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { armarBriefingProactivo } from "@/lib/agents/jefe-proactivo";
import { generarResumenJefe } from "@/lib/agents/jefe-gabinete";
import { enviarAlertaTelegram, loadTelegramConfig } from "@/lib/telegram";

// Cron: el Jefe de Gabinete (1) genera y persiste el resumen ejecutivo del día
// —dedup/agrupa/prioriza las recomendaciones vivas, para el Centro de Decisiones—
// y (2) manda el reporte proactivo por Telegram si está configurado.
export async function GET() {
  // (1) Resumen del Jefe: se persiste siempre, independiente de Telegram.
  let jefe: any = null;
  try {
    const r = await generarResumenJefe();
    jefe = { resultado: r.resultado, seleccionadas: r.seleccionadas.length, conflictos: r.conflictos.length, usoIA: r.usoIA };
  } catch (e: any) {
    jefe = { error: e?.message ?? "error" };
  }

  const cfg = await loadTelegramConfig();
  if (!cfg.botToken || !cfg.chatId) {
    return NextResponse.json({ ok: true, jefe, telegram: false, motivo: "Telegram no configurado" });
  }
  try {
    const texto = await armarBriefingProactivo();
    if (!texto) return NextResponse.json({ ok: true, jefe, enviado: false, motivo: "Sin novedades para reportar" });
    const enviado = await enviarAlertaTelegram(texto);
    return NextResponse.json({ ok: true, jefe, enviado });
  } catch (e: any) {
    return NextResponse.json({ ok: false, jefe, error: e?.message }, { status: 500 });
  }
}
