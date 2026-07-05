import { prisma } from "@/lib/prisma";
import { aiComplete } from "@/lib/ai";

const SYSTEM = `Sos el empleado virtual de marketing de una tienda argentina de mates, bombillas y regionales.
Generás borradores de campañas de Meta Ads (Facebook/Instagram) listos para revisar.
Español argentino, textos persuasivos y cercanos, sin exagerar ni inventar atributos del producto.
Si te dan una OCASIÓN (ej: Día de la Madre), ambientá toda la campaña en esa fecha (nombre, textos y ángulo).
Respondé SIEMPRE con JSON válido, sin markdown, con esta estructura exacta:
{
  "nombre_campana": "nombre corto y descriptivo",
  "objetivo": "ventas",
  "presupuesto_diario": <número en ARS, entre 3000 y 15000, acorde al precio del producto>,
  "duracion_dias": <número 7-21>,
  "segmentacion": { "nombre": "...", "edad_min": <18-45>, "edad_max": <35-65>, "intereses": ["...","..."], "razon": "..." },
  "anuncios": [
    { "nombre": "Variante A - <enfoque>", "texto_principal": "2-4 oraciones, puede incluir 1-2 emojis", "titulo": "máx 40 caracteres", "descripcion": "máx 90 caracteres", "cta": "SHOP_NOW|SEND_MESSAGE|LEARN_MORE" },
    { ...variante B con enfoque distinto... }
  ]
}
Exactamente 2 anuncios con enfoques distintos.`;

export interface GenerarCampanaOpts { estrategia?: string; ocasion?: string; }
export interface GenerarCampanaResult {
  ok: boolean; error?: string;
  campana_id?: number; nombre?: string; anuncios?: number; razon_publico?: string | null;
}

// Genera un borrador de campaña completo para un producto (opcionalmente
// ambientado en una ocasión/fecha) y lo persiste en el módulo Meta.
export async function generarCampana(productId: string, opts: GenerarCampanaOpts = {}): Promise<GenerarCampanaResult> {
  const producto = await prisma.product.findUnique({
    where: { id: String(productId) },
    include: { category: true, variants: { where: { active: true }, orderBy: { price: "asc" } } },
  });
  if (!producto || !producto.variants.length) {
    return { ok: false, error: "Producto no encontrado o sin variantes activas" };
  }

  const precio = Number(producto.variants[0].price);
  const costos: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT costo::float FROM product_pricing WHERE product_id = $1`, producto.id
  ).catch(() => []);
  const costo = costos[0]?.costo != null ? Number(costos[0].costo) : null;

  const contexto = {
    producto: producto.name,
    descripcion: producto.description?.slice(0, 500) ?? null,
    categoria: producto.category?.name ?? null,
    precio,
    margen_pct: costo != null ? Math.round(((precio - costo) / precio) * 100) : null,
    ocasion: opts.ocasion ?? null,
    estrategia: opts.estrategia === "rotacion"
      ? "producto sin ventas recientes: destrabarlo (ángulo de oferta/oportunidad)"
      : "producto que ya vende bien: escalar ventas",
  };

  let plan: any;
  try {
    const text = await aiComplete({
      system: SYSTEM,
      maxTokens: 1500,
      json: true,
      messages: [{ role: "user", content: `Generá el borrador de campaña para:\n${JSON.stringify(contexto, null, 2)}` }],
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("La IA no devolvió un plan válido");
    plan = JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    return { ok: false, error: `Error generando el plan: ${e?.message}` };
  }

  try {
    const urlDestino = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/producto/${producto.slug}`;
    const nombreCampana = String(plan.nombre_campana ?? `Campaña ${producto.name}`);

    const campanas: any[] = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_campanas (nombre, estado, objetivo, presupuesto_diario, notas)
      VALUES ($1, 'borrador', $2, $3, $4) RETURNING *
    `, nombreCampana, String(plan.objetivo ?? "ventas"),
       plan.presupuesto_diario ? Number(plan.presupuesto_diario) : null,
       `Generada por el empleado virtual${opts.ocasion ? ` para ${opts.ocasion}` : ""} · "${producto.name}". Duración sugerida: ${plan.duracion_dias ?? 14} días.`);
    const campana = campanas[0];

    const seg = plan.segmentacion ?? {};
    const conjuntos: any[] = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_conjuntos (campana_id, nombre, pais, edad_min, edad_max, sexo, idiomas, intereses, presupuesto_diario)
      VALUES ($1,$2,'AR',$3,$4,'todos','["es"]'::jsonb,$5::jsonb,$6) RETURNING *
    `, campana.id, String(seg.nombre ?? "Público principal"),
       Number(seg.edad_min ?? 25), Number(seg.edad_max ?? 55),
       JSON.stringify(Array.isArray(seg.intereses) ? seg.intereses : []),
       plan.presupuesto_diario ? Number(plan.presupuesto_diario) : null);
    const conjunto = conjuntos[0];

    const anuncios: any[] = Array.isArray(plan.anuncios) ? plan.anuncios.slice(0, 2) : [];
    for (const a of anuncios) {
      await (prisma as any).$executeRawUnsafe(`
        INSERT INTO meta_anuncios (conjunto_id, campana_id, nombre, formato, imagenes, texto_principal, titulo, descripcion, cta, url_destino)
        VALUES ($1,$2,$3,'imagen',$4::jsonb,$5,$6,$7,$8,$9)
      `, conjunto.id, campana.id, String(a.nombre ?? "Anuncio"),
         JSON.stringify(producto.imageUrls?.slice(0, 1) ?? []),
         String(a.texto_principal ?? ""), String(a.titulo ?? "").slice(0, 60),
         String(a.descripcion ?? "").slice(0, 120),
         ["SHOP_NOW", "SEND_MESSAGE", "LEARN_MORE", "CONTACT_US"].includes(a.cta) ? a.cta : "SHOP_NOW",
         urlDestino);
    }

    return { ok: true, campana_id: campana.id, nombre: nombreCampana, anuncios: anuncios.length, razon_publico: seg.razon ?? null };
  } catch (e: any) {
    return { ok: false, error: `Plan generado pero falló el guardado: ${e?.message}` };
  }
}
