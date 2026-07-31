export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { aiComplete, AINotConfiguredError } from "@/lib/ai";

const SYSTEM = `Sos community manager de una marca argentina de mates y productos regionales.
Escribís para Reels de Instagram y TikTok. Tono cercano, argentino (voseo), vendedor pero natural.
Devolvés SOLO un JSON con esta forma exacta:
{"hook":"texto corto para la primera pantalla del video (máx 40 caracteres, sin hashtags)","caption":"descripción del posteo, 2 a 4 líneas con emojis y un llamado a la acción","hashtags":["#sinNumeral","..."]}
Reglas: el hook tiene que enganchar en el primer segundo. En hashtags devolvé 10 a 12, relevantes a mate/regionales/Argentina/regalos, sin el símbolo #.`;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { nombre, precio, detalles } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Falta el producto" }, { status: 400 });

  const user = `Producto: ${nombre.trim()}${precio ? `\nPrecio: $${precio}` : ""}${detalles?.trim() ? `\nExtra: ${detalles.trim()}` : ""}\n\nGenerá el hook, la caption y los hashtags para un Reel.`;

  try {
    const texto = await aiComplete({ system: SYSTEM, messages: [{ role: "user", content: user }], temperature: 0.85, maxTokens: 400 });
    let data: any = {};
    const m = texto.match(/\{[\s\S]*\}/);
    if (m) { try { data = JSON.parse(m[0]); } catch { /* fallback abajo */ } }
    const hashtags = Array.isArray(data.hashtags)
      ? data.hashtags.map((h: any) => String(h).replace(/^#/, "").trim()).filter(Boolean).slice(0, 12)
      : [];
    return NextResponse.json({
      hook: String(data.hook ?? nombre).slice(0, 60),
      caption: String(data.caption ?? "").trim(),
      hashtags,
    });
  } catch (e) {
    if (e instanceof AINotConfiguredError) {
      return NextResponse.json({ error: "La IA no está configurada. Cargala en Admin → Inteligencia Artificial." }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo generar el texto" }, { status: 500 });
  }
}
