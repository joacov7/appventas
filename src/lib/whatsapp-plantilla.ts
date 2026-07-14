import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { loadWhatsAppConfig } from "@/lib/whatsapp-config";

// ─── Plantillas de WhatsApp (para abordaje en frío por la API) ────────────────
// Meta solo permite escribir a alguien que nunca te escribió mediante una
// PLANTILLA pre-aprobada. Acá guardamos qué plantilla usar para el abordaje y
// la enviamos con las variables del prospecto.

const KEY = "whatsapp_plantilla";

export interface PlantillaConfig {
  nombre: string;   // nombre exacto de la plantilla aprobada en Meta
  idioma: string;   // código de idioma, ej: es_AR o es
}

export async function loadPlantillaConfig(): Promise<PlantillaConfig> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, KEY);
    const c = rows[0]?.config ?? {};
    return { nombre: c.nombre || "", idioma: c.idioma || "es_AR" };
  } catch {
    return { nombre: "", idioma: "es_AR" };
  }
}

export async function savePlantillaConfig(cfg: PlantillaConfig): Promise<void> {
  await ensureSchema("config");
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ($1, $2::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $2::jsonb, updated_at = NOW()`,
    KEY, JSON.stringify(cfg)
  );
}

function normalizarDestino(to: string): string {
  const d = to.replace(/[^\d]/g, "");
  if (d.startsWith("549") && d.length >= 12) return "54" + d.slice(3);
  return d;
}

// Envía la plantilla de abordaje a un número, con las variables ({{1}}, {{2}}…).
export async function enviarPlantillaAbordaje(
  to: string, params: string[]
): Promise<{ ok: boolean; error?: string }> {
  const { accessToken, phoneNumberId } = await loadWhatsAppConfig();
  if (!accessToken || !phoneNumberId) return { ok: false, error: "WhatsApp no configurado (falta token/phone id)." };

  const { nombre, idioma } = await loadPlantillaConfig();
  if (!nombre) return { ok: false, error: "Falta configurar el nombre de la plantilla de abordaje." };

  const components = params.length
    ? [{ type: "body", parameters: params.map(p => ({ type: "text", text: String(p).slice(0, 200) })) }]
    : [];

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizarDestino(to),
        type: "template",
        template: { name: nombre, language: { code: idioma }, components },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Meta respondió ${res.status}: ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "error de conexión" };
  }
}
