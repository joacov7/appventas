import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { loadWhatsAppConfig } from "@/lib/whatsapp-config";
import { loadTelegramConfig } from "@/lib/telegram";
import { loadConfig } from "@/lib/ai/config";
import { loadAgentConfigs } from "@/lib/agents/config";

// Checkup de configuración del negocio: revisa (determinísticamente) qué está
// listo y qué falta preparar. Sin IA, sin costo. Pensado para dejar el sistema
// a punto antes de salir a vender.

async function count(sql: string): Promise<number> {
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(sql);
    return Number(rows[0]?.n ?? 0);
  } catch { return 0; }
}

export interface ItemCheckup { ok: boolean; tema: string; detalle: string }

export async function checkupNegocio(): Promise<ItemCheckup[]> {
  await ensureSchema("fabricantes", "personalizados", "captacion", "cotizador");

  const items: ItemCheckup[] = [];

  // ── Catálogo ──
  const productos = await prisma.product.count({ where: { active: true } }).catch(() => 0);
  items.push({ ok: productos > 0, tema: "Productos", detalle: productos > 0 ? `${productos} productos activos.` : "No hay productos activos. Cargá el catálogo." });

  const conCosto = await count(`SELECT COUNT(*)::int AS n FROM product_pricing WHERE costo IS NOT NULL AND costo > 0`);
  const faltanCosto = Math.max(0, productos - conCosto);
  items.push({ ok: productos === 0 || faltanCosto === 0, tema: "Costos", detalle: faltanCosto > 0 ? `${faltanCosto} producto(s) sin costo cargado — sin costo no ves margen ni cotizás bien.` : "Todos con costo cargado." });

  // ── Fabricantes ──
  const fabricantes = await count(`SELECT COUNT(*)::int AS n FROM fabricantes`);
  items.push({ ok: fabricantes > 0, tema: "Fabricantes", detalle: fabricantes > 0 ? `${fabricantes} fabricante(s) cargado(s).` : "No cargaste fabricantes — el cotizador no aplica reglas de precio." });

  // ── Personalizados (mockup) ──
  const modelos = await count(`SELECT COUNT(*)::int AS n FROM modelos_personalizados`);
  items.push({ ok: modelos > 0, tema: "Modelos de mockup", detalle: modelos > 0 ? `${modelos} modelo(s) cargado(s).` : "No hay modelos en el mockup — subí fotos de tus productos para mostrar el logo al cliente." });

  // ── Prospectos ──
  const prospectos = await count(`SELECT COUNT(*)::int AS n FROM prospectos`);
  items.push({ ok: prospectos > 0, tema: "Prospectos", detalle: prospectos > 0 ? `${prospectos} prospecto(s) en la cartera.` : "No tenés prospectos cargados — buscá comercios/empresas en Captación." });

  // ── Canales ──
  const wa = await loadWhatsAppConfig().catch(() => null);
  const waOk = !!(wa?.accessToken && wa?.phoneNumberId);
  items.push({ ok: waOk, tema: "WhatsApp", detalle: waOk ? "Conectado." : "WhatsApp no está conectado." });

  const tg = await loadTelegramConfig().catch(() => null);
  const tgOk = !!(tg?.botToken && tg?.chatId);
  items.push({ ok: tgOk, tema: "Telegram", detalle: tgOk ? "Avisos activos." : "Telegram no configurado." });

  const ai = await loadConfig().catch(() => null);
  const aiOk = !!(ai && ai.proveedores?.[ai.activo]?.enabled && ai.proveedores?.[ai.activo]?.apiKey);
  items.push({ ok: aiOk, tema: "Inteligencia Artificial", detalle: aiOk ? `Proveedor activo: ${ai!.activo}.` : "No hay proveedor de IA configurado (afecta al jefe y a los agentes)." });

  // ── Agentes ──
  try {
    const cfgs = await loadAgentConfigs();
    const prendidos = Object.values(cfgs).filter((c: any) => c.enabled).length;
    items.push({ ok: prendidos > 0, tema: "Agentes", detalle: `${prendidos} agente(s) activo(s).` });
  } catch { /* opcional */ }

  return items;
}

// Versión en texto para Telegram (determinística, sin IA).
export async function checkupTexto(): Promise<string> {
  const items = await checkupNegocio();
  const faltan = items.filter(i => !i.ok);
  const listos = items.filter(i => i.ok);

  const lineas: string[] = ["🩺 <b>Checkup del sistema</b>"];
  if (faltan.length === 0) {
    lineas.push("\n✅ Está todo en orden para arrancar. ¡A la cancha!");
  } else {
    lineas.push(`\n⚠️ <b>Para completar (${faltan.length}):</b>`);
    for (const i of faltan) lineas.push(`• <b>${i.tema}:</b> ${i.detalle}`);
  }
  if (listos.length) {
    lineas.push(`\n✅ <b>Ya listo:</b> ${listos.map(i => i.tema).join(", ")}.`);
  }
  return lineas.join("\n");
}
