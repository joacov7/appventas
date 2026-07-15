import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { loadWhatsAppConfig } from "@/lib/whatsapp-config";
import {
  type Segmento, detectarSegmento, interpretarRespuestaSegmento, preguntaSegmento,
  getContacto, setSegmento, marcarEsperandoSegmento, botSilenciado,
} from "@/lib/whatsapp-segmento";
import { loadBotTextos, render, type BotTextos } from "@/lib/bot-config";

// Nombre de la tienda para el placeholder {tienda}.
async function nombreTienda(): Promise<string> {
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'store_config'`);
    return rows[0]?.config?.storeName || "nuestra tienda";
  } catch { return "nuestra tienda"; }
}

// Categorías (rubros) que tienen al menos un producto con stock.
async function categoriasConProductos(): Promise<{ id: string; name: string; slug: string }[]> {
  try {
    return await (prisma as any).$queryRawUnsafe(`
      SELECT DISTINCT c.id, c.name, c.slug
      FROM categories c
      JOIN products p ON p."categoryId" = c.id AND p.active = true
      JOIN product_variants v ON v."productId" = p.id AND v.active = true AND v.stock > 0
      WHERE c.active = true
      ORDER BY c.name
    `);
  } catch { return []; }
}

// Busca una categoría cuyo nombre matchee lo que escribió el cliente.
function matchCategoria(texto: string, cats: { id: string; name: string; slug: string }[]) {
  const t = texto.toLowerCase().trim();
  if (t.length < 3) return null;
  return cats.find(c => t.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(t)) ?? null;
}

// Productos de una categoría (con precio según segmento).
async function productosDeCategoria(catId: string) {
  try {
    return await (prisma as any).$queryRawUnsafe(`
      SELECT p.id, p.name, p.slug, MIN(v.price)::float AS price
      FROM products p
      JOIN product_variants v ON v."productId" = p.id AND v.active = true AND v.stock > 0
      WHERE p."categoryId" = $1 AND p.active = true
      GROUP BY p.id, p.name, p.slug, p.featured
      ORDER BY p.featured DESC, p.name
      LIMIT 8
    `, catId);
  } catch { return []; }
}

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

// Precio mayorista por producto (desde product_pricing). Para minorista usamos
// directamente el price de la variante (lo mismo que muestra la tienda).
async function preciosMayoristas(productIds: string[]): Promise<Record<string, number>> {
  if (!productIds.length) return {};
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT product_id, precio_mayorista FROM product_pricing
       WHERE product_id = ANY($1) AND precio_mayorista IS NOT NULL AND precio_mayorista > 0`,
      productIds
    );
    const map: Record<string, number> = {};
    for (const r of rows) map[r.product_id] = Number(r.precio_mayorista);
    return map;
  } catch { return {}; }
}

// Devuelve el precio "desde" a mostrar según el segmento del contacto.
function precioDesde(
  variantPrice: number, productId: string, seg: Segmento, may: Record<string, number>
): { precio: number; esMayorista: boolean } {
  if (seg === "minorista") return { precio: variantPrice, esMayorista: false };
  const m = may[productId];
  return m ? { precio: m, esMayorista: true } : { precio: variantPrice, esMayorista: false };
}

// ── Bot responses ─────────────────────────────────────────────────────────────

const GREETINGS = /^(hola+|ola+|hi|hey|buenas|buen[ao]s?\s*(días?|tardes?|noches?)|saludos?|hello|q(ue|é)?\s*(onda|tal))/i;
const CATALOG_TRIGGERS = /^(cat[aá]l?[oa]go?|cat[aá]lg?o|productos?|ver\s+(cat|prod|todo)|quiero\s+ver|que\s+(tienen|tenes|ten[eé]s|venden|hay)|mostr[aá]|ver[eé]?|🧉|1)/i;
const REGALOS_TRIGGERS = /(regalo|empresa|empresarial|personaliz|con\s+logo|con\s+mi\s+logo|grabar|souvenir|merchandis|🎁)/i;
const PRICE_TRIGGERS = /^(precio|preci?os?|presi?o|consultar|consulta|cu[aá]nto|cotiz|valor|sale|cuesta|📦|2)/i;
const HELP_TRIGGERS = /^(ayuda|help|hablar|asesor|humano|(una\s+)?persona|👨|3|4)/i;
const ORDER_TRIGGERS = /^(comprar|pedido|pedir|checkout|hacer\s+pedido|quiero\s+comprar|como\s+compro)/i;
const HOURS_TRIGGERS = /^(horario|cuando\s+atienden|cu[aá]ndo\s+atienden|atienden|abren|est[aá]n\s+abiert|a\s+qu[eé]\s+hora)/i;

// "Ver catálogo": muestra las categorías con productos (o, si no hay categorías
// clasificadas, cae a la muestra de destacados).
async function catalogMessage(textos: BotTextos, tienda: string, seg: Segmento = "minorista") {
  const cats = await categoriasConProductos();
  if (cats.length > 0) {
    const lista = cats.map(c => `• *${c.name}*`).join("\n");
    const intro = render(textos.catalogo_intro, { link: APP_URL, tienda });
    const cierre = seg === "empresarial"
      ? `\n\n✨ Todo se puede personalizar con tu logo. O escribí *regalos* para una cotización.`
      : `\n\nO mirá todo en 👉 ${APP_URL}`;
    return `${intro}\n\n${lista}${cierre}`;
  }
  // Sin categorías: muestra de destacados (comportamiento anterior).
  const products = await getFeaturedProducts();
  if (products.length === 0) return `Pronto tendremos productos disponibles. Visitá ${APP_URL} para ver el catálogo completo.`;
  const may = seg === "minorista" ? {} : await preciosMayoristas(products.map(p => p.id));
  const lines = products.map((p) => {
    const v = p.variants[0];
    if (!v) return `• *${p.name}* — Consultar`;
    const { precio, esMayorista } = precioDesde(Number(v.price), p.id, seg, may);
    return `• *${p.name}* — ${formatARS(precio)}${esMayorista ? " (mayorista)" : ""}\n  ${APP_URL}/producto/${p.slug}`;
  });
  return `🛍️ *Nuestros productos:*\n\n${lines.join("\n\n")}\n\n🔍 Escribí el nombre de un producto, o entrá a ${APP_URL}.`;
}

// Productos de una categoría elegida.
async function categoriaMessage(cat: { id: string; name: string; slug: string }, seg: Segmento) {
  const productos: any[] = await productosDeCategoria(cat.id);
  if (!productos.length) return `Por ahora no tengo *${cat.name}* con stock. Mirá el catálogo completo en ${APP_URL}`;
  const may = seg === "minorista" ? {} : await preciosMayoristas(productos.map(p => p.id));
  const lines = productos.map(p => {
    const { precio, esMayorista } = precioDesde(Number(p.price), p.id, seg, may);
    return `• *${p.name}* — ${formatARS(precio)}${esMayorista ? " (may.)" : ""}\n  ${APP_URL}/producto/${p.slug}`;
  });
  const nota = seg === "empresarial" ? `\n\n✨ Personalizables con tu logo — pedime una cotización.` : "";
  return `🧉 *${cat.name}:*\n\n${lines.join("\n\n")}\n\nVer todos 👉 ${APP_URL}/productos?category=${cat.slug}${nota}`;
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

async function priceQueryMessage(query?: string, seg: Segmento = "minorista") {
  if (!query || query.trim().length < 2) {
    return `¿Qué producto querés consultar? Escribí el nombre y te digo el precio 👇`;
  }
  const products = await searchProducts(query);
  if (products.length === 0) {
    return `Mmm, no lo encontré con ese nombre exacto 🤔 Capaz lo tenemos con otro nombre.

Escribí *catalogo* para ver todo, o mirá el catálogo completo en:
${APP_URL}`;
  }
  const may = seg === "minorista" ? {} : await preciosMayoristas(products.map(p => p.id));
  const lines = products.map((p) => {
    const v = p.variants[0];
    if (!v) return `• *${p.name}* — sin stock`;
    const { precio, esMayorista } = precioDesde(Number(v.price), p.id, seg, may);
    return `• *${p.name}*\n  Desde ${formatARS(precio)}${esMayorista ? " (mayorista)" : ""}\n  ${APP_URL}/producto/${p.slug}`;
  });
  const nota = seg === "empresarial"
    ? `\n\n✨ Se pueden personalizar con tu logo. Decime cantidad y te cotizo 📄`
    : seg === "mayorista"
      ? `\n\n📦 Precios mayoristas por cantidad.`
      : "";
  return `🔍 Resultado para "${query}":\n\n${lines.join("\n\n")}${nota}`;
}

// ── Main message handler ──────────────────────────────────────────────────────

// Calcula la respuesta del bot para un texto (sin registrar ni enviar).
// Reutilizable por el flujo de texto y el de voz.
export async function computarRespuesta(waId: string, texto: string, esPrimerContacto: boolean): Promise<string> {
  const text = texto.trim();
  const esSaludo = GREETINGS.test(text);

  // Textos editables + nombre de la tienda para los placeholders.
  const textos = await loadBotTextos();
  const tienda = await nombreTienda();
  const R = (t: string) => render(t, { link: APP_URL, tienda });

  const contacto = await getContacto(waId);

  // (a) Si estábamos esperando que elija 1/2/3 (segmento), interpretamos.
  if (contacto.esperandoSegmento) {
    const elegido = interpretarRespuestaSegmento(text);
    if (elegido) {
      await setSegmento(waId, elegido);
      return elegido === "empresarial" ? R(textos.regalos) : await catalogMessage(textos, tienda, elegido);
    }
    await marcarEsperandoSegmento(waId, false);
  }

  // Opción "Regalos empresariales / personalizados": fija empresarial y cotiza.
  if (REGALOS_TRIGGERS.test(text)) {
    await setSegmento(waId, "empresarial");
    const pref = esPrimerContacto && !esSaludo ? `${R(textos.bienvenida)}\n\n` : "";
    return `${pref}${R(textos.regalos)}`;
  }

  // (b) El propio mensaje puede delatar el segmento ("mayorista", "con logo", …).
  const detectado = detectarSegmento(text);
  if (detectado && detectado !== contacto.segmento) await setSegmento(waId, detectado);
  const seg: Segmento | null = detectado ?? contacto.segmento;
  const segEfectivo: Segmento = seg ?? "minorista";

  // Saludo → menú.
  if (esSaludo) return R(textos.menu);

  // Ver catálogo → lista de categorías (no necesita saber el segmento aún).
  if (CATALOG_TRIGGERS.test(text)) {
    const cat = await catalogMessage(textos, tienda, segEfectivo);
    return esPrimerContacto ? `${R(textos.bienvenida)}\n\n${cat}` : cat;
  }
  if (HELP_TRIGGERS.test(text)) return R(textos.asesor);
  if (HOURS_TRIGGERS.test(text)) return R(textos.horarios);
  if (ORDER_TRIGGERS.test(text)) {
    return `¡Perfecto! Podés hacer tu pedido directo desde la tienda 🛒\n\n👉 ${APP_URL}\n\nMúltiples medios de pago y envío a todo el país.`;
  }

  // ¿Hay intención concreta de producto? (comando de precio, categoría o match)
  const cats = await categoriasConProductos();
  const catElegida = matchCategoria(text, cats);
  const productos = text.length > 2 ? await searchProducts(text) : [];
  const hayIntentProducto = PRICE_TRIGGERS.test(text) || !!catElegida || productos.length > 0;

  const conBienvenida = (t: string) => (esPrimerContacto ? `${R(textos.bienvenida)}\n\n${t}` : t);

  // El mensaje delató el segmento pero NO busca un producto puntual
  // (ej: "mayorista", "para mi empresa"): mostramos su oferta, no un fallback.
  if (detectado && !hayIntentProducto) {
    return conBienvenida(detectado === "empresarial"
      ? R(textos.regalos)
      : await catalogMessage(textos, tienda, segEfectivo));
  }

  // Consulta de producto/precio sin saber el segmento → preguntamos una vez.
  if (hayIntentProducto && !seg) {
    await marcarEsperandoSegmento(waId, true);
    return conBienvenida(preguntaSegmento());
  }

  let response: string;
  if (catElegida) {
    response = await categoriaMessage(catElegida, segEfectivo);
  } else if (productos.length > 0) {
    response = await priceQueryMessage(text, segEfectivo);
  } else if (PRICE_TRIGGERS.test(text)) {
    response = R(textos.consultar);
  } else {
    // No es producto ni comando reconocido: menú amable (o acuse si es empresa).
    response = segEfectivo === "empresarial" ? R(textos.cotizacion_recibida) : R(textos.menu);
  }

  if (esPrimerContacto && !esSaludo) response = `${R(textos.bienvenida)}\n\n${response}`;
  return response;
}

export async function handleIncomingMessage(waId: string, messageText: string) {
  const text = messageText.trim();
  const esPrimerContacto = await esNuevoContacto(waId);
  await logMessage(waId, "entrante", text);
  // Si un humano está atendiendo esta charla, el bot no interrumpe (pero el
  // mensaje queda registrado y el aviso a Telegram se dispara igual).
  if (await botSilenciado(waId)) return;
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
