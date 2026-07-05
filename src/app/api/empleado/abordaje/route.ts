export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { aiComplete } from "@/lib/ai";

const SYSTEM = `Sos el empleado virtual de ventas de una tienda argentina de mates, bombillas, regionales y artículos personalizados.
Escribís mensajes de primer contacto por WhatsApp. Según el tipo de negocio, tenés DOS ofertas distintas y elegís la correcta:

(A) REVENTA MAYORISTA — para COMERCIOS que pueden revender (regalerías, tabaquerías, bazares, kioscos, librerías, artículos de hogar, artesanías, souvenirs):
   Ofrecé ser su proveedor mayorista de mates/bombillas/combos para revender, con margen y envío a su zona.

(B) REGALOS EMPRESARIALES / PERSONALIZADOS — para EMPRESAS que NO revenden (concesionarias, industrias, fábricas, oficinas, agencias, seguros, inmobiliarias, cooperativas, supermercados, estudios, consultoras, organismos):
   Ofrecé mates y artículos PERSONALIZADOS con su logo/marca como regalo empresarial (para clientes, empleados, fin de año, eventos, aniversarios, merchandising).

Reglas:
- Elegí SIEMPRE el ángulo correcto según el rubro y el nombre del negocio. Te paso un "enfoque_sugerido" como guía, pero corregilo si el rubro deja claro que es otro. NUNCA ofrezcas reventa a quien claramente no revende (ej: una concesionaria de autos → regalos empresariales, jamás reventa).
- Español argentino, tono cercano y profesional, sin ser invasivo ni desesperado.
- Corto: 50-90 palabras. Es un primer mensaje de WhatsApp, no un mail.
- Personalizado con el nombre del negocio, su rubro y su zona cuando los tengas.
- Cerrá con una pregunta simple que invite a responder (ej: "¿te paso el catálogo mayorista?" o "¿te muestro opciones de mates con tu logo?").
- Si te paso productos con precio, podés mencionar UNO como ejemplo. NO inventes descuentos ni plazos que no te haya pasado.
Respondé SOLO con el texto del mensaje, sin comillas ni explicaciones.`;

// Clasifica el rubro del prospecto para sugerir el enfoque del mensaje.
// Revendedor = comercio minorista que podría revender; corporativo = el resto.
function enfoqueSugerido(rubro?: string | null, nombre?: string | null): "reventa_mayorista" | "regalos_empresariales" {
  const t = `${rubro ?? ""} ${nombre ?? ""}`.toLowerCase();
  const revendedor = /regal|tabac|bazar|kiosc|almac|hogar|house|artesan|gift|tobacco|convenience|variety|craft|libr|station|jugue|toy|souvenir|deco|marroquin/;
  return revendedor.test(t) ? "reventa_mayorista" : "regalos_empresariales";
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { prospectoId } = await req.json();
  if (!prospectoId) return NextResponse.json({ error: "prospectoId requerido" }, { status: 400 });

  // Columna para persistir el mensaje (tablas ya creadas antes de esta feature)
  await (prisma as any).$executeRawUnsafe(
    `ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS mensaje_abordaje TEXT`
  ).catch(() => {});

  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM prospectos WHERE id = $1`, Number(prospectoId)
  );
  const prospecto = rows[0];
  if (!prospecto) return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });

  // Contexto real: hasta 3 productos con precio mayorista configurado
  const productos: any[] = await (prisma as any).$queryRawUnsafe(`
    SELECT p.name, pp.precio_mayorista::float
    FROM product_pricing pp
    JOIN products p ON p.id = pp.product_id
    WHERE pp.precio_mayorista IS NOT NULL AND p.active = TRUE
    ORDER BY pp.updated_at DESC
    LIMIT 3
  `).catch(() => []);

  const contexto = {
    negocio: prospecto.nombre,
    rubro: prospecto.rubro ?? null,
    zona: prospecto.provincia ?? null,
    direccion: prospecto.direccion ?? null,
    enfoque_sugerido: enfoqueSugerido(prospecto.rubro, prospecto.nombre),
    productos_ejemplo: productos.map(p => ({
      producto: p.name,
      precio_mayorista: Number(p.precio_mayorista),
    })),
  };

  let mensaje: string;
  try {
    mensaje = (await aiComplete({
      system: SYSTEM,
      maxTokens: 400,
      messages: [{ role: "user", content: `Generá el mensaje de primer contacto para:\n${JSON.stringify(contexto, null, 2)}` }],
    })).trim();
    if (!mensaje) throw new Error("respuesta vacía");
  } catch (e: any) {
    return NextResponse.json({ error: `Error generando el mensaje: ${e?.message}` }, { status: 500 });
  }

  await (prisma as any).$executeRawUnsafe(
    `UPDATE prospectos SET mensaje_abordaje = $1 WHERE id = $2`, mensaje, Number(prospectoId)
  );

  return NextResponse.json({ ok: true, mensaje });
}
