export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { enviarPlantillaAbordaje, presupuestoAbordaje } from "@/lib/whatsapp-plantilla";
import { registrarInteraccion } from "@/lib/services/prospectos.service";
import { marcarAtendidoHumano } from "@/lib/whatsapp-segmento";
import { normalizarTelefonoAR } from "@/lib/telefono";

// Envía la plantilla de abordaje a un prospecto por la API (número del bot).
// La variable {{1}} de la plantilla se completa con el nombre del negocio.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { prospectoId, tipo } = await req.json();
  if (!prospectoId) return NextResponse.json({ error: "prospectoId requerido" }, { status: 400 });
  const tipoValido = ["mayorista", "empresa", "concesionaria"].includes(tipo) ? tipo : undefined;
  await ensureSchema("captacion");

  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, nombre, telefono FROM prospectos WHERE id = $1`, Number(prospectoId));
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });
  if (!p.telefono) return NextResponse.json({ error: "El prospecto no tiene teléfono" }, { status: 400 });

  // Control de gasto: si se llegó al tope mensual, no se envía.
  const presu = await presupuestoAbordaje();
  if (!presu.disponible) {
    return NextResponse.json({
      error: `Tope de gasto de abordaje alcanzado: ~US$${presu.gasto_usd} de US$${presu.limite_usd} este mes. Subilo en Bot de WhatsApp → Mensajes.`,
    }, { status: 402 });
  }

  // Número en formato E.164 (para el destino y para el wa_id del bot).
  const norm = normalizarTelefonoAR(p.telefono);
  const destino = norm ? norm.replace("+", "") : p.telefono.replace(/[^\d]/g, "");

  const r = await enviarPlantillaAbordaje(destino, [String(p.nombre)], tipoValido);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  // Registro: sale, pasa a contactado, queda en el historial y el bot no
  // interrumpe cuando el prospecto responda (lo atendés vos).
  try {
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO whatsapp_mensajes (wa_id, direccion, texto) VALUES ($1, 'saliente', $2)`,
      destino, "📤 Abordaje (plantilla) enviado");
    await (prisma as any).$executeRawUnsafe(
      `UPDATE prospectos SET estado = CASE WHEN estado = 'nuevo' THEN 'contactado' ELSE estado END,
         contactado_en = COALESCE(contactado_en, now()) WHERE id = $1`, Number(prospectoId));
    await registrarInteraccion(Number(prospectoId), { tipo: "contacto", canal: "whatsapp", detalle: "Abordaje enviado por plantilla (API)" });
    await marcarAtendidoHumano(destino);
  } catch { /* no crítico */ }

  return NextResponse.json({ ok: true });
}
