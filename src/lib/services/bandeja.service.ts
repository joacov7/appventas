import { prisma } from "@/lib/prisma";
import { enviarWhatsapp } from "./whatsapp.service";

// ─── Bandeja de entrada omnicanal ─────────────────────────────────────────────
// Unifica las conversaciones de todos los canales detrás de una interfaz común.
// Hoy conecta WhatsApp; Instagram/Facebook (Meta) se enchufan agregando una
// fuente más en `listarConversaciones` / `hiloConversacion` sin cambiar la UI.
//
// Base marketplace: el modelo ya distingue `canal`; cuando se multi-tenantice,
// cada consulta filtrará además por tenant_id (hoy implícito 'default').

export type Canal = "whatsapp" | "instagram" | "facebook";

export interface ConversacionResumen {
  canal: Canal;
  contacto: string;            // identificador del canal (wa_id, ig user, ...)
  ultimo_texto: string;
  ultima_fecha: string;
  ultima_direccion: "entrante" | "saliente" | "error";
  total: number;
  espera_respuesta: boolean;   // el último mensaje es del cliente
}

export interface MensajeHilo {
  direccion: "entrante" | "saliente" | "error";
  texto: string;
  fecha: string;
}

// Conversaciones de WhatsApp agrupadas por contacto.
async function conversacionesWhatsapp(): Promise<ConversacionResumen[]> {
  let rows: any[] = [];
  try {
    rows = await (prisma as any).$queryRawUnsafe(`
      SELECT wa_id, direccion, texto, creado_en FROM whatsapp_mensajes
      ORDER BY creado_en DESC LIMIT 500
    `);
  } catch { return []; }

  const porContacto = new Map<string, any[]>();
  for (const m of rows) {
    if (!porContacto.has(m.wa_id)) porContacto.set(m.wa_id, []);
    porContacto.get(m.wa_id)!.push(m);
  }

  const out: ConversacionResumen[] = [];
  for (const [wa_id, msgs] of porContacto) {
    const ultimo = msgs[0]; // ya vienen del más nuevo al más viejo
    out.push({
      canal: "whatsapp",
      contacto: wa_id,
      ultimo_texto: String(ultimo.texto ?? "").slice(0, 200),
      ultima_fecha: ultimo.creado_en,
      ultima_direccion: ultimo.direccion,
      total: msgs.length,
      espera_respuesta: ultimo.direccion === "entrante",
    });
  }
  return out;
}

// Lista todas las conversaciones de todos los canales, más nuevas primero.
export async function listarConversaciones(opts: { canal?: Canal } = {}): Promise<ConversacionResumen[]> {
  const fuentes: Promise<ConversacionResumen[]>[] = [];
  if (!opts.canal || opts.canal === "whatsapp") fuentes.push(conversacionesWhatsapp());
  // Futuro: if (!opts.canal || opts.canal === "instagram") fuentes.push(conversacionesInstagram());

  const todas = (await Promise.all(fuentes)).flat();
  return todas.sort((a, b) => new Date(b.ultima_fecha).getTime() - new Date(a.ultima_fecha).getTime());
}

// Devuelve el hilo completo de una conversación (orden cronológico).
export async function hiloConversacion(canal: Canal, contacto: string): Promise<MensajeHilo[]> {
  if (canal === "whatsapp") {
    try {
      const rows: any[] = await (prisma as any).$queryRawUnsafe(`
        SELECT direccion, texto, creado_en FROM whatsapp_mensajes
        WHERE wa_id = $1 ORDER BY creado_en ASC LIMIT 200
      `, contacto);
      return rows.map(r => ({ direccion: r.direccion, texto: r.texto, fecha: r.creado_en }));
    } catch { return []; }
  }
  return [];
}

// Responde en el canal correspondiente (ruteo por canal).
export async function responderConversacion(canal: Canal, contacto: string, texto: string): Promise<{ ok: boolean; enviado?: boolean; error?: string }> {
  if (!texto?.trim()) return { ok: false, error: "El mensaje está vacío" };
  if (canal === "whatsapp") {
    const r = await enviarWhatsapp(contacto, texto.trim());
    return { ok: true, enviado: r.enviado };
  }
  return { ok: false, error: `El canal "${canal}" todavía no está conectado.` };
}
