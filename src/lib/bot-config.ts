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
  catalogo_intro: "Elegí una categoría 👇 (o escribime el nombre del producto)",
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

// Reemplaza los placeholders del texto.
export function render(texto: string, vars: { link: string; tienda: string }): string {
  return (texto ?? "")
    .replaceAll("{link}", vars.link)
    .replaceAll("{tienda}", vars.tienda);
}
