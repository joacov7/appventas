import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { enviarAlertaTelegram } from "@/lib/telegram";

// Detecta conversaciones cuyo último mensaje es del cliente y llevan un rato sin
// respuesta (ni bot ni humano), y avisa por Telegram. Idempotente: no repite el
// aviso hasta que el cliente escriba de nuevo (recordado_en).
const MINUTOS_ESPERA = 45;

export async function avisarPendientes(): Promise<number> {
  await ensureSchema("whatsapp");

  let pend: any[] = [];
  try {
    pend = await (prisma as any).$queryRawUnsafe(`
      WITH ult AS (
        SELECT DISTINCT ON (wa_id) wa_id, direccion, texto, creado_en
        FROM whatsapp_mensajes
        ORDER BY wa_id, creado_en DESC
      )
      SELECT u.wa_id, u.texto, u.creado_en
      FROM ult u
      LEFT JOIN whatsapp_contactos c ON c.wa_id = u.wa_id
      WHERE u.direccion = 'entrante'
        AND u.creado_en < now() - interval '${MINUTOS_ESPERA} minutes'
        AND (c.recordado_en IS NULL OR c.recordado_en < u.creado_en)
      ORDER BY u.creado_en ASC
      LIMIT 20
    `);
  } catch {
    return 0;
  }

  if (!pend.length) return 0;

  const fmt = (s: string) => new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const lineas = pend.map(p => `• <b>${p.wa_id}</b> (${fmt(p.creado_en)}): ${String(p.texto ?? "").slice(0, 60)}`).join("\n");
  await enviarAlertaTelegram(
    `🔔 <b>${pend.length} conversación(es) de WhatsApp sin responder</b>\n\n${lineas}\n\nRespondé desde la Bandeja o citando el aviso acá.`
  ).catch(() => {});

  const ids = pend.map(p => p.wa_id);
  const ph = ids.map((_, i) => `$${i + 1}`).join(",");
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO whatsapp_contactos (wa_id, recordado_en)
     SELECT unnest(ARRAY[${ph}]::text[]), now()
     ON CONFLICT (wa_id) DO UPDATE SET recordado_en = now()`,
    ...ids
  ).catch(() => {});

  return pend.length;
}
