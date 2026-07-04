export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { aiComplete } from "@/lib/ai";

const SYSTEM = `Sos el empleado virtual de ventas mayoristas de una tienda argentina de mates, bombillas y regionales.
Escribís mensajes de primer contacto por WhatsApp para comercios (regalerías, tabaquerías, bazares, kioscos) ofreciéndoles ser su proveedor mayorista.
Reglas:
- Español argentino, tono cercano y profesional, sin ser invasivo ni desesperado.
- Corto: 50-90 palabras. Es un primer mensaje de WhatsApp, no un mail.
- Personalizado con el nombre del comercio, su rubro y su zona cuando los tengas.
- Mencioná concretamente qué ofrecés (mates, bombillas, combos armados para reventa) y UN gancho: margen para el comercio, envío a su zona, o combos listos para vender.
- Si te paso productos con precio mayorista, podés mencionar UNO como ejemplo concreto.
- Cerrá con una pregunta simple que invite a responder (ej: ¿te paso el catálogo mayorista?).
- NO inventes datos: ni descuentos específicos ni plazos que no te haya pasado.
Respondé SOLO con el texto del mensaje, sin comillas ni explicaciones.`;

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
    comercio: prospecto.nombre,
    rubro: prospecto.rubro ?? null,
    zona: prospecto.provincia ?? null,
    direccion: prospecto.direccion ?? null,
    productos_mayoristas_ejemplo: productos.map(p => ({
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
