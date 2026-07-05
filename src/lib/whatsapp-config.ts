import { prisma } from "@/lib/prisma";

const KEY = "whatsapp_config";

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  numeroPublico: string; // número mostrado a clientes (solo dígitos)
}

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS catalog_config (
      tipo TEXT PRIMARY KEY, config JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
    )`).catch(() => {});
}

// Config real (con secretos). Prioriza lo guardado en DB; cae a variables
// de entorno para no romper instalaciones que ya las tengan.
export async function loadWhatsAppConfig(): Promise<WhatsAppConfig> {
  await ensureTable();
  let saved: Partial<WhatsAppConfig> = {};
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, KEY
    );
    saved = rows[0]?.config ?? {};
  } catch { /* usa env */ }
  return {
    accessToken: saved.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: saved.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: saved.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || "",
    numeroPublico: saved.numeroPublico || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  };
}

export async function saveWhatsAppConfig(cfg: WhatsAppConfig): Promise<void> {
  await ensureTable();
  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO catalog_config (tipo, config) VALUES ($1, $2::jsonb)
    ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()
  `, KEY, JSON.stringify(cfg));
}

function mask(s: string): string {
  if (!s) return "";
  if (s.length <= 8) return "••••";
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

// Versión enmascarada para el frontend (no manda los secretos completos).
export async function loadWhatsAppMasked() {
  const c = await loadWhatsAppConfig();
  return {
    accessToken: mask(c.accessToken), hasToken: !!c.accessToken,
    phoneNumberId: c.phoneNumberId,     // no es secreto
    verifyToken: c.verifyToken,          // lo elige el usuario
    numeroPublico: c.numeroPublico,
  };
}

// Aplica edits conservando el token si no se editó (llega enmascarado).
export async function applyWhatsAppEdits(edits: any): Promise<WhatsAppConfig> {
  const actual = await loadWhatsAppConfig();
  const tokenEditado = typeof edits.accessToken === "string" && edits.accessToken && edits.accessToken !== mask(actual.accessToken);
  return {
    accessToken: tokenEditado ? edits.accessToken : actual.accessToken,
    phoneNumberId: edits.phoneNumberId ?? actual.phoneNumberId,
    verifyToken: edits.verifyToken ?? actual.verifyToken,
    numeroPublico: edits.numeroPublico ?? actual.numeroPublico,
  };
}
