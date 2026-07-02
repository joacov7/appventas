export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `Sos un experto en publicidad digital y marketing para Facebook e Instagram en Argentina.
Tu especialidad es vender mates, termos, bombillas y accesorios relacionados.
Respondés siempre en español argentino informal, con textos atractivos, cercanos y persuasivos.
Devolvés SIEMPRE un JSON válido con la estructura exacta que te piden.`;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    const { tipo, contexto } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompts: Record<string, string> = {
      textos: `Generá 3 variantes de texto publicitario para un anuncio de Meta Ads. Contexto: ${contexto ?? "venta de mates artesanales"}. Respondé con JSON: {"variantes": [{"texto": "...", "tono": "emocional|urgencia|beneficio"}]}`,
      titulos: `Generá 5 títulos cortos (máx 40 chars) para anuncios de Meta Ads. Contexto: ${contexto ?? "mates y accesorios"}. JSON: {"titulos": ["..."]}`,
      descripciones: `Generá 3 descripciones (máx 90 chars) para anuncios. Contexto: ${contexto ?? "mates y accesorios"}. JSON: {"descripciones": ["..."]}`,
      cta: `Sugerí los mejores llamados a la acción (CTA) para anuncios de Meta Ads en este contexto: ${contexto ?? "venta de mates"}. JSON: {"ctas": [{"boton": "SHOP_NOW|SEND_MESSAGE|LEARN_MORE|CONTACT_US", "texto": "por qué funciona"}]}`,
      ab: `Creá 2 variantes A/B completas de un anuncio de Meta Ads para: ${contexto ?? "mates artesanales"}. JSON: {"variantes": [{"nombre": "A", "titulo": "...", "texto": "...", "descripcion": "...", "enfoque": "..."}]}`,
      ideas_video: `Generá 3 ideas de videos cortos (Reels/Stories) para Meta Ads sobre: ${contexto ?? "mates y cultura del mate"}. JSON: {"ideas": [{"titulo": "...", "duracion": "15s|30s|60s", "concepto": "...", "escenas": ["..."]}]}`,
      ideas_imagen: `Generá 4 ideas de imágenes/creatividades para anuncios de: ${contexto ?? "mates artesanales"}. JSON: {"ideas": [{"descripcion": "...", "estilo": "lifestyle|producto|texto|comparativo", "fondo": "...", "elementos": ["..."]}]}`,
      segmentacion: `Recomendá segmentaciones de audiencia para Meta Ads para vender: ${contexto ?? "mates y accesorios"} en Argentina. JSON: {"segmentaciones": [{"nombre": "...", "edad": "...", "intereses": ["..."], "comportamientos": ["..."], "razon": "..."}]}`,
      presupuesto: `Sugerí estrategias de presupuesto para Meta Ads para: ${contexto ?? "mates artesanales"} con presupuesto mensual de $50.000 ARS. JSON: {"sugerencias": [{"estrategia": "...", "presupuesto_diario": ..., "objetivo": "...", "duracion_dias": ..., "razon": "..."}]}`,
    };

    const prompt = prompts[tipo] ?? prompts.textos;
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

    return NextResponse.json({ tipo, result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
