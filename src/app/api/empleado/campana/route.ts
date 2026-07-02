export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

// ─── GET: productos candidatos para campaña, rankeados ───────────────────────
// Estrategia "ventas": mejor margen × ventas recientes (empujar lo que funciona)
// Estrategia "rotacion": productos con margen pero sin ventas (destrabar stock)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT
        p.id, p.name, p.slug, p."imageUrls",
        (SELECT MIN(v.price)::float FROM product_variants v
          WHERE v."productId" = p.id AND v.active = TRUE)        AS precio,
        pp.costo::float                                          AS costo,
        COALESCE((
          SELECT SUM(oi.quantity)::int FROM order_items oi
          JOIN orders o ON o.id = oi."orderId"
          WHERE oi."productId" = p.id AND o."createdAt" >= NOW() - INTERVAL '30 days'
            AND o.status IN ('PROCESSING','SHIPPED','DELIVERED')
        ), 0)                                                    AS ventas_30d
      FROM products p
      LEFT JOIN product_pricing pp ON pp.product_id = p.id
      WHERE p.active = TRUE
    `);

    const candidatos = rows
      .filter(r => r.precio != null && r.precio > 0)
      .map(r => {
        const margenPct = r.costo != null ? ((r.precio - r.costo) / r.precio) * 100 : null;
        return {
          id: r.id,
          nombre: r.name,
          slug: r.slug,
          imagen: r.imageUrls?.[0] ?? null,
          precio: Number(r.precio),
          costo: r.costo != null ? Number(r.costo) : null,
          margen_pct: margenPct,
          ventas_30d: r.ventas_30d,
          // Score ventas: margen (o 30 por defecto) ponderado por ventas
          score_ventas: (margenPct ?? 30) * (1 + r.ventas_30d),
        };
      });

    const paraVentas = [...candidatos].sort((a, b) => b.score_ventas - a.score_ventas).slice(0, 8);
    const paraRotacion = candidatos
      .filter(c => c.ventas_30d === 0 && (c.margen_pct == null || c.margen_pct > 20))
      .slice(0, 8);

    return NextResponse.json({ ventas: paraVentas, rotacion: paraRotacion });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

const SYSTEM = `Sos el empleado virtual de marketing de una tienda argentina de mates, bombillas y regionales.
Generás borradores de campañas de Meta Ads (Facebook/Instagram) listos para revisar.
Español argentino, textos persuasivos y cercanos, sin exagerar ni inventar atributos del producto.
Respondé SIEMPRE con JSON válido, sin markdown, con esta estructura exacta:
{
  "nombre_campana": "nombre corto y descriptivo",
  "objetivo": "ventas",
  "presupuesto_diario": <número en ARS, entre 3000 y 15000, acorde al precio del producto>,
  "duracion_dias": <número 7-21>,
  "segmentacion": {
    "nombre": "nombre del público",
    "edad_min": <18-45>, "edad_max": <35-65>,
    "intereses": ["...", "..."],
    "razon": "por qué este público"
  },
  "anuncios": [
    {
      "nombre": "Variante A - <enfoque>",
      "texto_principal": "texto del anuncio, 2-4 oraciones, puede incluir 1-2 emojis",
      "titulo": "máx 40 caracteres",
      "descripcion": "máx 90 caracteres",
      "cta": "SHOP_NOW|SEND_MESSAGE|LEARN_MORE"
    },
    { ...variante B con enfoque distinto... }
  ]
}
Exactamente 2 anuncios con enfoques distintos (ej: emocional vs beneficio/precio).`;

// ─── POST: generar borrador de campaña completo para un producto ─────────────
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 503 });
  }

  const { productId, estrategia } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId requerido" }, { status: 400 });

  const producto = await prisma.product.findUnique({
    where: { id: String(productId) },
    include: { category: true, variants: { where: { active: true }, orderBy: { price: "asc" } } },
  });
  if (!producto || !producto.variants.length) {
    return NextResponse.json({ error: "Producto no encontrado o sin variantes activas" }, { status: 404 });
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
    estrategia: estrategia === "rotacion"
      ? "producto sin ventas recientes: el objetivo es destrabarlo (podés sugerir ángulo de oferta/oportunidad)"
      : "producto que ya vende bien: el objetivo es escalar ventas",
  };

  let plan: any;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: `Generá el borrador de campaña para:\n${JSON.stringify(contexto, null, 2)}` }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("La IA no devolvió un plan válido");
    plan = JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    return NextResponse.json({ error: `Error generando el plan: ${e?.message}` }, { status: 500 });
  }

  // Persistir como borrador en el módulo Meta existente
  try {
    const urlDestino = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/producto/${producto.slug}`;

    const campanas: any[] = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_campanas (nombre, estado, objetivo, presupuesto_diario, notas)
      VALUES ($1, 'borrador', $2, $3, $4)
      RETURNING *
    `, String(plan.nombre_campana ?? `Campaña ${producto.name}`),
       String(plan.objetivo ?? "ventas"),
       plan.presupuesto_diario ? Number(plan.presupuesto_diario) : null,
       `Generada por el empleado virtual para "${producto.name}". Duración sugerida: ${plan.duracion_dias ?? 14} días.`);
    const campana = campanas[0];

    const seg = plan.segmentacion ?? {};
    const conjuntos: any[] = await (prisma as any).$queryRawUnsafe(`
      INSERT INTO meta_conjuntos (campana_id, nombre, pais, edad_min, edad_max, sexo, idiomas, intereses, presupuesto_diario)
      VALUES ($1,$2,'AR',$3,$4,'todos','["es"]'::jsonb,$5::jsonb,$6)
      RETURNING *
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

    return NextResponse.json({
      ok: true,
      campana_id: campana.id,
      nombre: campana.nombre,
      anuncios: anuncios.length,
      razon_publico: seg.razon ?? null,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: `Plan generado pero falló el guardado: ${e?.message}` }, { status: 500 });
  }
}
