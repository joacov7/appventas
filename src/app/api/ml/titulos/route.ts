export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { aiComplete, AINotConfiguredError } from "@/lib/ai";

const SYSTEM = `Sos experto en SEO de Mercado Libre Argentina. Generás títulos de publicación que posicionan y venden.
Reglas de un buen título de ML:
- Máximo 60 caracteres.
- Formato: Producto + Marca + Modelo + Atributos clave (material, medida, color, capacidad).
- Las palabras más buscadas primero.
- En singular, sin emojis, sin signos raros.
- PROHIBIDO: "envío gratis", "oferta", "promoción", "barato", "mejor precio", MAYÚSCULAS sostenidas, datos de contacto.
Devolvés SOLO un array JSON de 6 strings (los títulos), sin texto adicional.`;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { nombre, detalles } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Poné al menos el nombre del producto" }, { status: 400 });

  const userMsg = `Producto: ${nombre.trim()}${detalles?.trim() ? `\nDatos extra (marca, material, medidas, color, etc.): ${detalles.trim()}` : ""}\n\nGenerá 6 títulos ganadores para Mercado Libre.`;

  try {
    const texto = await aiComplete({
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.8,
      maxTokens: 400,
    });

    // Intentar parsear el array JSON; si no, extraer líneas.
    let titulos: string[] = [];
    const match = texto.match(/\[[\s\S]*\]/);
    if (match) {
      try { titulos = JSON.parse(match[0]); } catch { /* sigue al fallback */ }
    }
    if (!titulos.length) {
      titulos = texto.split("\n").map(l => l.replace(/^[\s\-\d.)"']+/, "").replace(/["']+$/, "").trim()).filter(Boolean);
    }
    titulos = titulos.map(t => String(t).slice(0, 60)).filter(Boolean).slice(0, 6);
    if (!titulos.length) return NextResponse.json({ error: "No se pudieron generar títulos, probá de nuevo." }, { status: 502 });
    return NextResponse.json({ titulos });
  } catch (e) {
    if (e instanceof AINotConfiguredError) {
      return NextResponse.json({ error: "La IA no está configurada. Cargá el proveedor en Admin → Inteligencia Artificial." }, { status: 400 });
    }
    return NextResponse.json({ error: "Error generando títulos" }, { status: 500 });
  }
}
