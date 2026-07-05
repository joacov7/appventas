export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { aiComplete, AINotConfiguredError } from "@/lib/ai";

interface LineaIn { nombre: string; cantidad: number; precio_unitario: number; subtotal: number }
interface Body {
  cliente_nombre?: string; canal?: string; medio_pago?: string;
  lineas: LineaIn[]; total: number; empresa?: string;
}

const money = (n: number) => "$" + Math.round(Number(n)).toLocaleString("es-AR");

// Mensaje determinístico (sin IA): resumen prolijo listo para enviar.
function mensajeBase(b: Body): string {
  const saludo = b.cliente_nombre ? `¡Hola ${b.cliente_nombre}! 👋` : "¡Hola! 👋";
  const detalle = b.lineas.map(l => `• ${l.cantidad}× ${l.nombre} — ${money(l.subtotal)}`).join("\n");
  const firma = b.empresa ? `\n\nSaludos,\n${b.empresa}` : "";
  return `${saludo}\n\nTe paso el presupuesto que armamos:\n\n${detalle}\n\n*Total: ${money(b.total)}*\n\nCualquier duda quedo a disposición. ¡Gracias!${firma}`;
}

const SYSTEM =
  "Sos un vendedor argentino cordial y profesional. Redactás un mensaje breve (WhatsApp) " +
  "para enviarle un presupuesto a un cliente. Tono cercano pero prolijo, sin exagerar emojis " +
  "(uno o dos como mucho). No inventes precios ni productos: usá exactamente los datos dados. " +
  "Devolvé SOLO el texto del mensaje, sin encabezados ni comillas.";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const b = (await req.json()) as Body;
  if (!Array.isArray(b?.lineas) || b.lineas.length === 0) {
    return NextResponse.json({ error: "El presupuesto no tiene ítems" }, { status: 400 });
  }

  const base = mensajeBase(b);

  // La IA es último recurso: solo mejora la redacción. Si no está configurada
  // o falla, se devuelve el mensaje determinístico igual (sin gastar nada).
  try {
    const texto = await aiComplete({
      system: SYSTEM,
      maxTokens: 500,
      messages: [{
        role: "user",
        content:
          `Cliente: ${b.cliente_nombre || "sin nombre"}\n` +
          `Canal: ${b.canal || "minorista"} · Medio de pago: ${b.medio_pago || "-"}\n` +
          `Ítems:\n${b.lineas.map(l => `- ${l.cantidad}× ${l.nombre}: ${money(l.subtotal)}`).join("\n")}\n` +
          `Total: ${money(b.total)}\n` +
          (b.empresa ? `Empresa que firma: ${b.empresa}\n` : "") +
          `\nRedactá el mensaje para enviarle este presupuesto.`,
      }],
    });
    const limpio = texto?.trim();
    return NextResponse.json({ mensaje: limpio && limpio.length > 20 ? limpio : base, con_ia: !!(limpio && limpio.length > 20) });
  } catch (e: any) {
    if (e instanceof AINotConfiguredError) {
      return NextResponse.json({ mensaje: base, con_ia: false });
    }
    return NextResponse.json({ mensaje: base, con_ia: false });
  }
}
