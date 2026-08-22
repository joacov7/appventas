import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppMedia } from "@/lib/whatsapp-bot";

export interface ConversacionPendiente {
  wa_id: string;
  ultimo_cliente: string;
  motivo: string;
  fecha: string;
}

// Frases con las que el bot "se rinde" o deriva a una persona (incluye el
// fallback cálido "dejame chequear..." para que el agente las detecte).
const FALLBACK = ["No encontré", "Enseguida te conectamos", "Probá con", "Dejame chequear", "chequear eso"];

// Conversaciones que necesitan atención humana: el bot no supo responder
// o el cliente pidió hablar con alguien. El agente las trabaja con IA.
export async function conversacionesPendientes(limitConv = 10): Promise<ConversacionPendiente[]> {
  let rows: any[] = [];
  try {
    rows = await (prisma as any).$queryRawUnsafe(
      `SELECT wa_id, direccion, texto, creado_en FROM whatsapp_mensajes
       ORDER BY creado_en DESC LIMIT 300`
    );
  } catch { return []; }

  // Agrupar por conversación conservando orden (más nuevo primero)
  const porConv = new Map<string, any[]>();
  for (const m of rows) {
    if (!porConv.has(m.wa_id)) porConv.set(m.wa_id, []);
    porConv.get(m.wa_id)!.push(m);
  }

  const pendientes: ConversacionPendiente[] = [];
  for (const [wa_id, msgs] of porConv) {
    const ultimoSaliente = msgs.find(m => m.direccion === "saliente");
    const ultimoEntrante = msgs.find(m => m.direccion === "entrante");
    if (!ultimoEntrante) continue;

    const botSeRindio = ultimoSaliente && FALLBACK.some(f => String(ultimoSaliente.texto).includes(f));
    const clienteEsperaRespuesta = msgs[0]?.direccion === "entrante"; // el último mensaje es del cliente

    if (botSeRindio || clienteEsperaRespuesta) {
      pendientes.push({
        wa_id,
        ultimo_cliente: String(ultimoEntrante.texto).slice(0, 300),
        motivo: clienteEsperaRespuesta ? "El cliente escribió y no hay respuesta" : "El bot no supo responder",
        fecha: ultimoEntrante.creado_en,
      });
    }
    if (pendientes.length >= limitConv) break;
  }
  return pendientes;
}

// Envía un WhatsApp y lo registra en el historial.
export async function enviarWhatsapp(to: string, texto: string): Promise<{ ok: boolean; enviado: boolean }> {
  const env = await sendWhatsAppMessage(to, texto);
  try {
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO whatsapp_mensajes (wa_id, direccion, texto, wam_id, estado) VALUES ($1, 'saliente', $2, $3, $4)`,
      to, texto, env.wamId ?? null, env.ok ? "sent" : "failed"
    );
  } catch { /* no crítico */ }
  // Esta vía es respuesta de un humano/agente → el bot se calla para ese contacto.
  try {
    const { marcarAtendidoHumano } = await import("@/lib/whatsapp-segmento");
    await marcarAtendidoHumano(to);
  } catch { /* no crítico */ }
  const conectado = !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  return { ok: true, enviado: conectado };
}

// Envía una imagen o PDF (por URL) y lo registra en el historial.
export async function enviarWhatsappMedia(
  to: string, url: string, tipo: "image" | "document", caption?: string
): Promise<{ ok: boolean; enviado: boolean; error?: string }> {
  const r = await sendWhatsAppMedia(to, url, tipo, caption);
  if (!r.ok) return { ok: false, enviado: false, error: r.error };
  const etiqueta = (tipo === "document" ? "📄 Archivo enviado" : "📷 Foto enviada") + (caption ? `: ${caption}` : "");
  try {
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO whatsapp_mensajes (wa_id, direccion, texto, wam_id, estado) VALUES ($1, 'saliente', $2, $3, 'sent')`,
      to, etiqueta, r.wamId ?? null
    );
  } catch { /* no crítico */ }
  try {
    const { marcarAtendidoHumano } = await import("@/lib/whatsapp-segmento");
    await marcarAtendidoHumano(to);
  } catch { /* no crítico */ }
  const conectado = !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  return { ok: true, enviado: conectado };
}

// ─── Conversaciones priorizadas por intención de compra (Fase 5D) ────────────
// Enriquece las conversaciones pendientes con su tipo e intención (0-100),
// ordenadas de mayor a menor intención. Determinístico (sin IA para puntuar).
export async function conversacionesPriorizadas(limitConv = 15) {
  const { analizarConversacion } = await import("@/lib/agents/whatsapp-intel.logic");
  const pendientes = await conversacionesPendientes(limitConv);
  return pendientes
    .map(c => ({ ...c, ...analizarConversacion(c.wa_id, c.ultimo_cliente) }))
    .sort((a, b) => b.intencion - a.intencion);
}
