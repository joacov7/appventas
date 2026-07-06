import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { loadWhatsAppConfig } from "@/lib/whatsapp-config";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://appventas-iota.vercel.app";

// ── Send a text message via Meta Cloud API ───────────────────────────────────

async function registrarError(to: string, texto: string) {
  // Deja el error visible en el Historial (direccion 'error') para diagnosticar
  try {
    await ensureSchema("whatsapp");
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO whatsapp_mensajes (wa_id, direccion, texto) VALUES ($1, 'error', $2)`,
      to, texto.slice(0, 800)
    );
  } catch { /* no crítico */ }
}

// Argentina: los wa_id entrantes vienen como 54 + 9 + área + número, pero para
// ENVIAR hay que sacar ese "9" o Meta acepta el mensaje y no lo entrega.
function normalizarDestino(to: string): string {
  const d = to.replace(/[^\d]/g, "");
  if (d.startsWith("549") && d.length >= 12) return "54" + d.slice(3);
  return d;
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const { accessToken, phoneNumberId } = await loadWhatsAppConfig();
  if (!accessToken || !phoneNumberId) {
    await registrarError(to, "WhatsApp no configurado: falta Access Token o Phone Number ID en el admin.");
    return { ok: false, error: "no configurado" };
  }
  const destino = normalizarDestino(to);
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destino,
          type: "text",
          text: { body: text },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("[WA Bot] Send error:", err);
      await registrarError(to, `Error al enviar (HTTP ${res.status}): ${err}`);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e: any) {
    await registrarError(to, `Error de conexión al enviar: ${e?.message ?? "desconocido"}`);
    return { ok: false, error: e?.message };
  }
}

// ── Log messages to DB ───────────────────────────────────────────────────────

async function ensureTable() {
  await ensureSchema("whatsapp");
}

async function logMessage(waId: string, direccion: "entrante" | "saliente", texto: string) {
  try {
    await ensureTable();
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO whatsapp_mensajes (wa_id, direccion, texto) VALUES ($1, $2, $3)`,
      waId, direccion, texto
    );
  } catch { /* non-critical */ }
}

// ── Product search ───────────────────────────────────────────────────────────

async function searchProducts(query: string) {
  return prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { variants: { where: { active: true, stock: { gt: 0 } }, orderBy: { price: "asc" }, take: 2 } },
    take: 5,
  });
}

async function getFeaturedProducts() {
  return prisma.product.findMany({
    where: { active: true, variants: { some: { active: true, stock: { gt: 0 } } } },
    include: { variants: { where: { active: true, stock: { gt: 0 } }, orderBy: { price: "asc" }, take: 1 } },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 6,
  });
}

function formatARS(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
}

// ── Bot responses ─────────────────────────────────────────────────────────────

const GREETINGS = /^(hola|hi|hey|buenas|buen[ao]s?\s*(días?|tardes?|noches?)|saludos?|ola|hello)/i;
const CATALOG_TRIGGERS = /^(catalogo|catálogo|productos?|ver\s+productos?|quiero\s+ver|1)/i;
const PRICE_TRIGGERS = /^(precio|precios|cuanto\s+sale|cuánto\s+sale|2)/i;
const HELP_TRIGGERS = /^(ayuda|help|hablar\s+con\s+alguien|asesor|3|humano)/i;
const ORDER_TRIGGERS = /^(comprar|pedido|pedir|checkout|hacer\s+pedido|quiero\s+comprar)/i;
const HOURS_TRIGGERS = /^(horario|horarios|cuando\s+atienden|cuándo\s+atienden)/i;

function menuMessage() {
  return `¡Hola! 👋 Bienvenido/a a nuestra tienda.

¿En qué te puedo ayudar?

1️⃣ *Ver catálogo* — Ver nuestros productos
2️⃣ *Precio* — Consultar precio de un producto
3️⃣ *Ayuda* — Hablar con una persona

O escribí directamente el nombre del producto que buscás 🔍`;
}

function helpMessage() {
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  return `Enseguida te conectamos con alguien del equipo 👤

📞 También podés llamarnos o escribirnos directamente.
🌐 Visitá nuestra tienda: ${APP_URL}

¡En breve te responden!`;
}

async function catalogMessage() {
  const products = await getFeaturedProducts();
  if (products.length === 0) {
    return `Pronto tendremos productos disponibles. Visitá ${APP_URL} para ver el catálogo completo.`;
  }
  const lines = products.map((p) => {
    const v = p.variants[0];
    const price = v ? formatARS(Number(v.price)) : "Consultar";
    return `• *${p.name}* — ${price}\n  ${APP_URL}/producto/${p.slug}`;
  });
  return `🛍️ *Nuestros productos:*\n\n${lines.join("\n\n")}\n\n🔍 Escribí el nombre de un producto para más info, o entrá a ${APP_URL} para ver todos.`;
}

// Bienvenida breve para el primer contacto (cuando no arrancan con "hola")
function bienvenidaBreve() {
  return `¡Hola! 👋 Gracias por escribirnos 🧉`;
}

// Fallback cálido: cuando el bot no entiende, no manda un error frío.
// Le avisa al cliente que lo van a atender (vos respondés con el agente).
function fallbackCalido() {
  return `¡Gracias por tu mensaje! 🧉 Dejame chequear eso y en un ratito te respondo 😊

Mientras tanto, si querés podés:
• Escribir *catalogo* para ver nuestros productos
• Entrar a ${APP_URL}
• Escribir *ayuda* si preferís que te atienda una persona`;
}

// ¿Es la primera vez que este número nos escribe?
async function esNuevoContacto(waId: string): Promise<boolean> {
  try {
    await ensureTable();
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT 1 FROM whatsapp_mensajes WHERE wa_id = $1 LIMIT 1`, waId
    );
    return rows.length === 0;
  } catch {
    return false;
  }
}

async function priceQueryMessage(query?: string) {
  if (!query || query.trim().length < 2) {
    return `¿Qué producto querés consultar? Escribí el nombre y te digo el precio 👇`;
  }
  const products = await searchProducts(query);
  if (products.length === 0) {
    return `Mmm, no lo encontré con ese nombre exacto 🤔 Capaz lo tenemos con otro nombre.

Escribí *catalogo* para ver todo, o mirá el catálogo completo en:
${APP_URL}`;
  }
  const lines = products.map((p) => {
    const v = p.variants[0];
    if (!v) return `• *${p.name}* — sin stock`;
    const price = formatARS(Number(v.price));
    return `• *${p.name}*\n  Desde ${price}\n  ${APP_URL}/producto/${p.slug}`;
  });
  return `🔍 Resultado para "${query}":\n\n${lines.join("\n\n")}`;
}

// ── Main message handler ──────────────────────────────────────────────────────

// Calcula la respuesta del bot para un texto (sin registrar ni enviar).
// Reutilizable por el flujo de texto y el de voz.
export async function computarRespuesta(waId: string, texto: string, esPrimerContacto: boolean): Promise<string> {
  const text = texto.trim();
  let response: string;
  const esSaludo = GREETINGS.test(text);

  if (esSaludo) {
    response = menuMessage();
  } else if (CATALOG_TRIGGERS.test(text)) {
    response = await catalogMessage();
  } else if (ORDER_TRIGGERS.test(text)) {
    response = `¡Perfecto! Podés hacer tu pedido directo desde nuestra tienda 🛒\n\n👉 ${APP_URL}\n\nTenemos múltiples medios de pago y envío a todo el país.`;
  } else if (HELP_TRIGGERS.test(text)) {
    response = helpMessage();
  } else if (HOURS_TRIGGERS.test(text)) {
    response = `🕐 Atendemos consultas por este medio de lunes a viernes de 9 a 18hs.\n\nPara comprar podés hacerlo en cualquier momento desde ${APP_URL} 🛍️`;
  } else if (PRICE_TRIGGERS.test(text)) {
    response = await priceQueryMessage();
  } else if (text.length > 2) {
    const products = await searchProducts(text);
    response = products.length > 0 ? await priceQueryMessage(text) : fallbackCalido();
  } else {
    response = menuMessage();
  }

  if (esPrimerContacto && !esSaludo) {
    response = `${bienvenidaBreve()}\n\n${response}`;
  }
  return response;
}

export async function handleIncomingMessage(waId: string, messageText: string) {
  const text = messageText.trim();
  const esPrimerContacto = await esNuevoContacto(waId);
  await logMessage(waId, "entrante", text);
  const response = await computarRespuesta(waId, text, esPrimerContacto);
  await logMessage(waId, "saliente", response);
  await sendWhatsAppMessage(waId, response);
}

// Flujo de voz: dada la transcripción, registra el entrante y devuelve la
// respuesta del bot (el envío como audio lo hace el módulo de voz).
export async function responderMensajeVoz(waId: string, textoTranscripto: string): Promise<string> {
  const esPrimerContacto = await esNuevoContacto(waId);
  await logMessage(waId, "entrante", `🎤 ${textoTranscripto}`);
  const response = await computarRespuesta(waId, textoTranscripto, esPrimerContacto);
  await logMessage(waId, "saliente", response);
  return response;
}
