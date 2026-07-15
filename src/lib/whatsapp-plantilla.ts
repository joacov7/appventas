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

// ─── Control de gasto del abordaje por plantilla ─────────────────────────────
// Cada plantilla de Marketing cuesta ~US$0.06 en Argentina. Contamos los envíos
// del mes y frenamos al llegar al tope (default US$40/mes, editable).
export const COSTO_ABORDAJE_USD = 0.06;
const LIMITE_ABORDAJE_DEFAULT = 40;

function mesActual(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export async function limiteAbordajeUsd(): Promise<number> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'whatsapp_abordaje_cfg'`);
    const v = Number(rows[0]?.config?.limite_usd);
    return Number.isFinite(v) && v >= 0 ? v : LIMITE_ABORDAJE_DEFAULT;
  } catch { return LIMITE_ABORDAJE_DEFAULT; }
}

export async function setLimiteAbordajeUsd(limite: number): Promise<void> {
  await ensureSchema("config");
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ('whatsapp_abordaje_cfg', $1::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    JSON.stringify({ limite_usd: limite })
  );
}

export async function usoAbordajeMes(): Promise<{ enviados: number; gasto_usd: number }> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, `whatsapp_abordaje_uso:${mesActual()}`);
    const enviados = Number(rows[0]?.config?.enviados ?? 0);
    return { enviados, gasto_usd: Math.round(enviados * COSTO_ABORDAJE_USD * 100) / 100 };
  } catch { return { enviados: 0, gasto_usd: 0 }; }
}

async function registrarUsoAbordaje(n: number): Promise<void> {
  try {
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO catalog_config (tipo, config) VALUES ($1, jsonb_build_object('enviados', $2::int))
       ON CONFLICT (tipo) DO UPDATE SET
         config = jsonb_set(catalog_config.config, '{enviados}',
           (COALESCE((catalog_config.config->>'enviados')::int, 0) + $2::int)::text::jsonb),
         updated_at = NOW()`,
      `whatsapp_abordaje_uso:${mesActual()}`, n
    );
  } catch { /* el conteo no debe romper el envío */ }
}

export async function presupuestoAbordaje(): Promise<{ limite_usd: number; enviados: number; gasto_usd: number; disponible: boolean }> {
  const [limite_usd, uso] = await Promise.all([limiteAbordajeUsd(), usoAbordajeMes()]);
  return { limite_usd, ...uso, disponible: uso.gasto_usd < limite_usd };
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
    await registrarUsoAbordaje(1);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "error de conexión" };
  }
}
