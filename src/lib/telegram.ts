import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Avisos al dueño por Telegram (gratis, instantáneo, sin plantillas).
// Config guardada en catalog_config (key 'telegram_config'), con fallback a env.

const KEY = "telegram_config";

export interface TelegramConfig { botToken: string; chatId: string; secret?: string }

export async function loadTelegramConfig(): Promise<TelegramConfig> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, KEY
    );
    const c = rows[0]?.config ?? {};
    return {
      botToken: c.botToken || process.env.TELEGRAM_BOT_TOKEN || "",
      chatId: c.chatId || process.env.TELEGRAM_CHAT_ID || "",
      secret: c.secret || "",
    };
  } catch {
    return { botToken: process.env.TELEGRAM_BOT_TOKEN || "", chatId: process.env.TELEGRAM_CHAT_ID || "", secret: "" };
  }
}

// Registra el webhook de Telegram para recibir TUS respuestas (puente de 2 vías).
export async function configurarWebhookTelegram(urlBase: string): Promise<boolean> {
  const cfg = await loadTelegramConfig();
  if (!cfg.botToken) return false;
  const secret = cfg.secret || Math.random().toString(36).slice(2) + Date.now().toString(36);
  if (!cfg.secret) await saveTelegramConfig({ ...cfg, secret });
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `${urlBase}/api/telegram/webhook`,
        secret_token: secret,
        allowed_updates: ["message"],
      }),
    });
    return res.ok;
  } catch { return false; }
}

export async function saveTelegramConfig(cfg: TelegramConfig): Promise<void> {
  await ensureSchema("config");
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ($1, $2::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()`,
    KEY, JSON.stringify(cfg)
  );
}

// Aviso de un WhatsApp entrante. El número queda embebido ("De: …") para que,
// al responder citando este mensaje, sepamos a quién contestarle.
export async function alertaNuevoWhatsapp(waId: string, texto: string, esVoz = false): Promise<boolean> {
  const cuerpo = esVoz ? `🎤 (audio) ${texto}` : texto;
  const msg =
    `🟢 <b>Nuevo WhatsApp</b>\n` +
    `De: ${waId}\n\n` +
    `${cuerpo}\n\n` +
    `↩️ <i>Respondé a este mensaje para contestarle.</i>`;
  return enviarAlertaTelegram(msg);
}

// Extrae el número de WhatsApp del texto de un aviso ("De: 549...").
export function waIdDesdeTextoAlerta(texto: string | undefined): string | null {
  if (!texto) return null;
  const m = texto.match(/De:\s*(\d{6,})/);
  return m ? m[1] : null;
}

// Envía un aviso. Devuelve true si se pudo. Nunca lanza (no debe romper el flujo).
export async function enviarAlertaTelegram(texto: string): Promise<boolean> {
  const { botToken, chatId } = await loadTelegramConfig();
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
