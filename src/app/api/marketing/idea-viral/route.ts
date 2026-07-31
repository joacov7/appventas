export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { aiComplete, AINotConfiguredError } from "@/lib/ai";

// Arma un resumen compacto del catálogo (precio, costo→margen, stock) para que
// la IA elija la mejor oportunidad.
async function resumenCatalogo(focoId?: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { active: true, ...(focoId ? { id: focoId } : {}) },
    include: { category: { select: { name: true } }, variants: { where: { active: true }, orderBy: { price: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: focoId ? 1 : 60,
  });

  let costos: Record<string, number | null> = {};
  try {
    await ensureSchema("pricing");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`SELECT product_id, costo FROM product_pricing`);
    for (const r of rows) costos[r.product_id] = r.costo != null ? Number(r.costo) : null;
  } catch { /* sin costos */ }

  const lineas = products.map(p => {
    const precio = p.variants[0]?.price != null ? Number(p.variants[0].price) : null;
    const stock = p.variants.reduce((a, v) => a + v.stock, 0);
    const costo = costos[p.id] ?? null;
    const margen = precio && costo ? Math.round(((precio - costo) / precio) * 100) : null;
    return `- ${p.name}${p.category?.name ? ` (${p.category.name})` : ""}: precio ${precio ? `$${precio}` : "s/d"}${margen != null ? `, margen ~${margen}%` : ""}, stock ${stock}`;
  });
  return lineas.join("\n");
}

const SYSTEM = `Sos estratega de contenidos de una marca argentina de mates y productos regionales que vende minorista y mayorista.
Tu trabajo: mirar el catálogo y proponer UNA idea de contenido con alto potencial viral y de venta, bien concreta y accionable (no genérica).
Pensá primero como estratega (objetivo, público, emoción, gancho) y recién después la ejecución.
Aprovechá ángulos que funcionan: comparar dos productos (barato vs premium), psicología de precios, el "error" que comete la gente, detrás de escena, escasez, autoridad artesanal.
Elegí producto(s) con buena oportunidad (margen alto, diferencia visual marcada, stock disponible).
Respondé SOLO un JSON:
{"producto":"nombre (o dos si es comparación)","objetivo":"...","publico":"...","emocion":"...","formato":"Reel|Carrusel|Historia","gancho":"frase de apertura potente","idea":"por qué funciona, 1-2 frases","guion":["paso a grabar/mostrar","..."],"texto_pantalla":["frase corta para el video","..."],"caption":"texto para el posteo","hashtags":["sinNumeral","..."]}`;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { focoId, evitar } = await req.json().catch(() => ({}));

  const catalogo = await resumenCatalogo(focoId).catch(() => "");
  if (!catalogo) return NextResponse.json({ error: "No hay productos para analizar" }, { status: 400 });

  const user = `Catálogo:\n${catalogo}\n\n${evitar ? `Ya propusiste esto, dame algo DISTINTO (otro producto o ángulo): ${evitar}\n\n` : ""}Proponé UNA idea viral concreta.`;

  try {
    const texto = await aiComplete({ system: SYSTEM, messages: [{ role: "user", content: user }], temperature: 0.95, maxTokens: 700 });
    const m = texto.match(/\{[\s\S]*\}/);
    let d: any = {};
    if (m) { try { d = JSON.parse(m[0]); } catch { /* fallback */ } }
    if (!d.gancho && !d.idea) return NextResponse.json({ error: "No se pudo generar la idea, probá de nuevo." }, { status: 502 });
    return NextResponse.json({
      producto: String(d.producto ?? "").trim(),
      objetivo: String(d.objetivo ?? "").trim(),
      publico: String(d.publico ?? "").trim(),
      emocion: String(d.emocion ?? "").trim(),
      formato: String(d.formato ?? "Reel").trim(),
      gancho: String(d.gancho ?? "").trim(),
      idea: String(d.idea ?? "").trim(),
      guion: Array.isArray(d.guion) ? d.guion.map((x: any) => String(x)) : [],
      texto_pantalla: Array.isArray(d.texto_pantalla) ? d.texto_pantalla.map((x: any) => String(x)) : [],
      caption: String(d.caption ?? "").trim(),
      hashtags: Array.isArray(d.hashtags) ? d.hashtags.map((x: any) => String(x).replace(/^#/, "")).filter(Boolean).slice(0, 12) : [],
    });
  } catch (e) {
    if (e instanceof AINotConfiguredError) {
      return NextResponse.json({ error: "La IA no está configurada. Cargala en Admin → Inteligencia Artificial." }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo generar la idea" }, { status: 500 });
  }
}
