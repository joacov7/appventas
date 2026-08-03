import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Textos del bot de WhatsApp (editables desde el admin) ────────────────────
// Se guardan en catalog_config (tipo 'bot_textos'). Si falta alguno, se usa el
// default. Placeholders soportados: {link} (URL de la tienda), {tienda} (nombre).

export interface BotTextos {
  bienvenida: string;   // primer contacto (si no saluda)
  menu: string;         // menú principal
  catalogo_intro: string; // antes de listar las categorías
  regalos: string;      // pitch de regalos empresariales/personalizados
  consultar: string;    // pedir el nombre del producto
  asesor: string;       // derivar a una persona
  horarios: string;     // horarios de atención
  fallback: string;     // cuando no entiende
  cotizacion_recibida: string; // empresa ya dio datos → acuse + derivación
}

export const BOT_DEFAULTS: BotTextos = {
  bienvenida: "¡Hola! 👋 Gracias por escribirnos 🧉",
  menu: `¡Hola! 👋 Bienvenido a {tienda}.

¿En qué puedo ayudarte?

🧉 *Ver catálogo*
🎁 *Regalos empresariales / personalizados*
📦 *Consultar un producto*
👨 *Hablar con un asesor*

Escribí una opción o el nombre del producto que buscás 🔍`,
  catalogo_intro: "¡Genial! 🧉 Mirá todo nuestro catálogo con precios acá 👇",
  regalos: `¡Buenísimo! 🙌 Trabajamos *regalos empresariales personalizados*: mates, termos, sets materos y más, *grabados con el logo de tu empresa* (láser o vinilo).

Ideal para clientes, empleados o eventos. Manejamos *precios por cantidad* y armamos el pack a medida.

Para cotizarte, contame:
• ¿Qué producto/s te interesan? (o te sugiero opciones)
• ¿Cantidad aproximada?
• ¿Tenés el logo en imagen?

Con eso te preparo un presupuesto 📄`,
  consultar: "Decime el nombre del producto que buscás y te paso info y precio 👇",
  asesor: `¡Listo! Aviso a una persona del equipo para que te atienda 👤

En breve te responden. Mientras, podés ver todo en {link}`,
  horarios: "🕐 Atendemos por este medio de lunes a viernes de 9 a 18hs.\n\nPara comprar podés hacerlo cuando quieras en {link} 🛍️",
  fallback: `¡Gracias por tu mensaje! 🧉 Dejame chequear eso y en un ratito te respondo 😊

Mientras tanto podés:
• Escribir *catálogo* para ver los productos
• Entrar a {link}
• Escribir *asesor* si preferís que te atienda una persona`,
  cotizacion_recibida: `¡Genial! 🙌 Tomo nota de eso. Con esos datos te preparamos el presupuesto y en breve te escribe alguien del equipo para cerrar los detalles 📄`,
};

export async function loadBotTextos(): Promise<BotTextos> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'bot_textos'`);
    const guardado = rows[0]?.config ?? {};
    return { ...BOT_DEFAULTS, ...guardado };
  } catch {
    return BOT_DEFAULTS;
  }
}

export async function saveBotTextos(textos: Partial<BotTextos>): Promise<void> {
  await ensureSchema("config");
  const actual = await loadBotTextos();
  const merged = { ...actual, ...textos };
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ('bot_textos', $1::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    JSON.stringify(merged)
  );
}

// ─── A dónde manda el bot cuando piden el catálogo ───────────────────────────
// "web" = la página de productos. "drive" = un link (ej: carpeta de Drive con
// fotos) provisorio, hasta terminar de cargar todo en la web.
export interface BotCatalogo {
  modo: "web" | "drive";
  drive_url: string;
}

export const CATALOGO_DEFAULT: BotCatalogo = { modo: "web", drive_url: "" };

export async function loadBotCatalogo(): Promise<BotCatalogo> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'bot_catalogo'`);
    const c = rows[0]?.config ?? {};
    return {
      modo: c.modo === "drive" ? "drive" : "web",
      drive_url: typeof c.drive_url === "string" ? c.drive_url : "",
    };
  } catch {
    return CATALOGO_DEFAULT;
  }
}

export async function saveBotCatalogo(cfg: BotCatalogo): Promise<void> {
  await ensureSchema("config");
  const limpio: BotCatalogo = {
    modo: cfg.modo === "drive" ? "drive" : "web",
    drive_url: String(cfg.drive_url ?? "").trim(),
  };
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ('bot_catalogo', $1::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    JSON.stringify(limpio)
  );
}

// ─── Modo IA conversacional ──────────────────────────────────────────────────
// Cuando el mensaje no cae en ningún flujo, en vez de responder el menú, la IA
// contesta con contexto (historial + info del negocio). Editable desde el admin.
export interface BotIA {
  activo: boolean;
  instrucciones: string; // tono/personalidad y reglas extra para la IA
  nombre: string;        // nombre del asistente (ej: "Sofi")
  demora: boolean;       // simular "escribiendo…" antes de responder
}

export const IA_DEFAULT: BotIA = { activo: false, instrucciones: "", nombre: "", demora: false };

export async function loadBotIA(): Promise<BotIA> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'bot_ia'`);
    const c = rows[0]?.config ?? {};
    return {
      activo: !!c.activo,
      instrucciones: typeof c.instrucciones === "string" ? c.instrucciones : "",
      nombre: typeof c.nombre === "string" ? c.nombre : "",
      demora: !!c.demora,
    };
  } catch {
    return IA_DEFAULT;
  }
}

export async function saveBotIA(cfg: BotIA): Promise<void> {
  await ensureSchema("config");
  const limpio: BotIA = {
    activo: !!cfg.activo,
    instrucciones: String(cfg.instrucciones ?? "").trim(),
    nombre: String(cfg.nombre ?? "").trim().slice(0, 40),
    demora: !!cfg.demora,
  };
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ('bot_ia', $1::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    JSON.stringify(limpio)
  );
}

// ─── Política de Ventas (agente / asistente) ─────────────────────────────────
// Reglas con las que el asistente vende. Todo editable desde el admin.
export interface PoliticaVentas {
  activa: boolean;
  permite_descuento: boolean;   // si el asistente puede ofrecer descuentos solo
  escalar_monto: number;        // deriva al humano si el pedido supera esto (ARS)
  medios_pago: string;
  envio: string;
  minimo_mayorista: string;
  descuento_volumen: string;    // texto (el dueño lo maneja a mano)
  cierre: "preparar_y_avisar" | "solo_avisar";
  extra: string;
}

export const POLITICA_DEFAULT: PoliticaVentas = {
  activa: true,
  permite_descuento: false,
  escalar_monto: 200000,
  medios_pago: "Transferencia bancaria",
  envio: "El envío corre por cuenta del comprador. Se despacha una vez confirmado el pago.",
  minimo_mayorista: "10 unidades surtidas",
  descuento_volumen: "Hay descuentos por compras de más de 50 unidades, pero los coordina el equipo (no los ofrezcas vos).",
  cierre: "preparar_y_avisar",
  extra: "",
};

export async function loadPoliticaVentas(): Promise<PoliticaVentas> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'politica_ventas'`);
    const c = rows[0]?.config;
    if (!c) return POLITICA_DEFAULT;
    return {
      activa: c.activa !== false,
      permite_descuento: !!c.permite_descuento,
      escalar_monto: Number(c.escalar_monto) || 0,
      medios_pago: typeof c.medios_pago === "string" ? c.medios_pago : POLITICA_DEFAULT.medios_pago,
      envio: typeof c.envio === "string" ? c.envio : POLITICA_DEFAULT.envio,
      minimo_mayorista: typeof c.minimo_mayorista === "string" ? c.minimo_mayorista : POLITICA_DEFAULT.minimo_mayorista,
      descuento_volumen: typeof c.descuento_volumen === "string" ? c.descuento_volumen : "",
      cierre: c.cierre === "solo_avisar" ? "solo_avisar" : "preparar_y_avisar",
      extra: typeof c.extra === "string" ? c.extra : "",
    };
  } catch { return POLITICA_DEFAULT; }
}

export async function savePoliticaVentas(p: PoliticaVentas): Promise<void> {
  await ensureSchema("config");
  const limpio: PoliticaVentas = {
    activa: p.activa !== false,
    permite_descuento: !!p.permite_descuento,
    escalar_monto: Math.max(0, Number(p.escalar_monto) || 0),
    medios_pago: String(p.medios_pago ?? "").trim(),
    envio: String(p.envio ?? "").trim(),
    minimo_mayorista: String(p.minimo_mayorista ?? "").trim(),
    descuento_volumen: String(p.descuento_volumen ?? "").trim(),
    cierre: p.cierre === "solo_avisar" ? "solo_avisar" : "preparar_y_avisar",
    extra: String(p.extra ?? "").trim(),
  };
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ('politica_ventas', $1::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    JSON.stringify(limpio));
}

// Arma el bloque de política para el prompt del asistente.
export function politicaVentasPrompt(p: PoliticaVentas): string {
  if (!p.activa) return "";
  const lineas = [
    `POLÍTICA DE VENTAS (respetala siempre):`,
    p.permite_descuento ? `- Podés ofrecer descuentos con criterio.` : `- NO ofrezcas descuentos por tu cuenta.`,
    p.minimo_mayorista ? `- Pedido mínimo mayorista: ${p.minimo_mayorista}.` : "",
    p.descuento_volumen ? `- Volumen: ${p.descuento_volumen}` : "",
    p.medios_pago ? `- Medios de pago: ${p.medios_pago}.` : "",
    p.envio ? `- Envío: ${p.envio}` : "",
    p.escalar_monto > 0 ? `- Si el pedido supera $${p.escalar_monto.toLocaleString("es-AR")} o es un reclamo/caso raro, derivá al equipo humano.` : "",
    p.cierre === "preparar_y_avisar"
      ? `- Cierre: cuando el cliente quiere comprar, tomá el pedido (productos y cantidades), confirmá los datos y avisá que el equipo lo prepara y le pasa los datos de pago. NO cierres el pago vos.`
      : `- Cierre: cuando el cliente quiere comprar, tomá los datos y avisá al equipo para que cierre; no confirmes el pedido vos.`,
    p.extra ? `- ${p.extra}` : "",
  ].filter(Boolean);
  return lineas.join("\n");
}

// Reemplaza los placeholders del texto.
export function render(texto: string, vars: { link: string; tienda: string }): string {
  return (texto ?? "")
    .replaceAll("{link}", vars.link)
    .replaceAll("{tienda}", vars.tienda);
}
