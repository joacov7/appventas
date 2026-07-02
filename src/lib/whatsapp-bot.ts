import { prisma } from "@/lib/prisma";

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://appventas-iota.vercel.app";

// ── Send a text message via Meta Cloud API ───────────────────────────────────

export async function sendWhatsAppMessage(to: string, text: string) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn("[WA Bot] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set");
    return;
  }
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error("[WA Bot] Send error:", err);
  }
}

// ── Log messages to DB ───────────────────────────────────────────────────────

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
      id          SERIAL PRIMARY KEY,
      wa_id       TEXT NOT NULL,
      direccion   TEXT NOT NULL DEFAULT 'entrante',
      texto       TEXT NOT NULL,
      creado_en   TIMESTAMPTZ DEFAULT now()
    )
  `);
  await (prisma as any).$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_wa_mensajes_wa_id ON whatsapp_mensajes(wa_id);
  `);
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

async function priceQueryMessage(query?: string) {
  if (!query || query.trim().length < 2) {
    return `¿Qué producto querés consultar? Escribí el nombre y te digo el precio 👇`;
  }
  const products = await searchProducts(query);
  if (products.length === 0) {
    return `No encontré "${query}" en nuestro catálogo 😕\n\nProbá con otro nombre o mirá todos los productos en:\n${APP_URL}`;
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

export async function handleIncomingMessage(waId: string, messageText: string) {
  const text = messageText.trim();
  await logMessage(waId, "entrante", text);

  let response: string;

  if (GREETINGS.test(text)) {
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
    // Try it as a product search
    const products = await searchProducts(text);
    if (products.length > 0) {
      response = await priceQueryMessage(text);
    } else {
      response = `No encontré "${text}" 🤔\n\nProbá con:\n• *catalogo* — para ver todos los productos\n• *precio [producto]* — para consultar un precio\n• *ayuda* — para hablar con alguien\n\nO visitá ${APP_URL}`;
    }
  } else {
    response = menuMessage();
  }

  await logMessage(waId, "saliente", response);
  await sendWhatsAppMessage(waId, response);
}
