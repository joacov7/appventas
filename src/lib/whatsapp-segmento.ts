import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Segmento comercial de un contacto de WhatsApp. Determina qué precio y qué
// conversación le corresponde.
export type Segmento = "minorista" | "mayorista" | "empresarial";

export interface Contacto {
  segmento: Segmento | null;
  esperandoSegmento: boolean;
}

// Señales en el texto del cliente que delatan su segmento (sin preguntar).
const SENALES_MAYORISTA = /\b(mayorista|por\s+mayor|al\s+por\s+mayor|revend(o|er|edor)?|revent[ao]|distribuidor|para\s+revender|precio\s+de\s+lista|lista\s+de\s+precios|por\s+cantidad|la\s+docena|x\s?\d{2,})\b/i;
const SENALES_EMPRESARIAL = /\b(empresa|empresarial|corporativ[oa]s?|para\s+mi\s+empresa|regalo(s)?\s+(empresarial|corporativ|para\s+empleados|para\s+clientes)|souvenirs?|merchandising|con\s+(nuestro\s+)?logo|grabar\s+(el\s+)?logo|logo\s+de\s+la\s+empresa|brande|branding|para\s+(mis\s+)?empleados)\b/i;

export function detectarSegmento(texto: string): Segmento | null {
  const t = texto.toLowerCase();
  if (SENALES_EMPRESARIAL.test(t)) return "empresarial";
  if (SENALES_MAYORISTA.test(t)) return "mayorista";
  return null; // minorista es el default: no lo forzamos por keyword
}

// Interpreta la RESPUESTA a la pregunta calificadora (1/2/3 o texto).
export function interpretarRespuestaSegmento(texto: string): Segmento | null {
  const t = texto.trim().toLowerCase();
  if (/^3\b|empresa|corporativ|regalo|logo|souvenir/.test(t)) return "empresarial";
  if (/^2\b|mayorista|revend|por\s+mayor|cantidad|reventa|distribuidor/.test(t)) return "mayorista";
  if (/^1\b|personal|minorista|para\s+m[ií]|uso\s+personal|una?\s+(unidad|sol[oa])/.test(t)) return "minorista";
  return null;
}

export function preguntaSegmento(): string {
  return `¡Genial! Para pasarte la info justa, contame: ¿la consulta es para…?

1️⃣ *Uso personal* (compra minorista)
2️⃣ *Revender* (precios mayoristas por cantidad)
3️⃣ *Mi empresa* (regalos corporativos / personalizados con logo)

Respondé *1*, *2* o *3* 🙂`;
}

export const ETIQUETA_SEGMENTO: Record<Segmento, string> = {
  minorista: "cliente minorista",
  mayorista: "cliente mayorista",
  empresarial: "cliente empresarial",
};

export async function getContacto(waId: string): Promise<Contacto> {
  try {
    await ensureSchema("whatsapp");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT segmento, esperando_segmento FROM whatsapp_contactos WHERE wa_id = $1`, waId
    );
    if (!rows.length) return { segmento: null, esperandoSegmento: false };
    return {
      segmento: (rows[0].segmento ?? null) as Segmento | null,
      esperandoSegmento: rows[0].esperando_segmento === true,
    };
  } catch {
    return { segmento: null, esperandoSegmento: false };
  }
}

export async function setSegmento(waId: string, seg: Segmento): Promise<void> {
  try {
    await ensureSchema("whatsapp");
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO whatsapp_contactos (wa_id, segmento, esperando_segmento, updated_at)
       VALUES ($1, $2, FALSE, now())
       ON CONFLICT (wa_id) DO UPDATE SET segmento = $2, esperando_segmento = FALSE, updated_at = now()`,
      waId, seg
    );
  } catch { /* no crítico */ }
}

// Horas que el bot queda en silencio para un contacto tras responder un humano.
const HORAS_SILENCIO = 12;

// Un humano (o agente aprobado) respondió: silenciamos el bot y limpiamos el
// pendiente (ya fue atendido).
export async function marcarAtendidoHumano(waId: string): Promise<void> {
  try {
    await ensureSchema("whatsapp");
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO whatsapp_contactos (wa_id, humano_hasta, recordado_en, updated_at)
       VALUES ($1, now() + interval '${HORAS_SILENCIO} hours', now(), now())
       ON CONFLICT (wa_id) DO UPDATE SET
         humano_hasta = now() + interval '${HORAS_SILENCIO} hours',
         recordado_en = now(),
         updated_at = now()`,
      waId
    );
  } catch { /* no crítico */ }
}

// ¿El bot está en silencio para este contacto (un humano lo está atendiendo)?
export async function botSilenciado(waId: string): Promise<boolean> {
  try {
    await ensureSchema("whatsapp");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT (humano_hasta IS NOT NULL AND humano_hasta > now()) AS silenciado
       FROM whatsapp_contactos WHERE wa_id = $1`, waId
    );
    return rows[0]?.silenciado === true;
  } catch { return false; }
}

export async function marcarEsperandoSegmento(waId: string, valor: boolean): Promise<void> {
  try {
    await ensureSchema("whatsapp");
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO whatsapp_contactos (wa_id, esperando_segmento, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (wa_id) DO UPDATE SET esperando_segmento = $2, updated_at = now()`,
      waId, valor
    );
  } catch { /* no crítico */ }
}
