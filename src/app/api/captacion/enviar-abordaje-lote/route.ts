export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { enviarPlantillaAbordaje, presupuestoAbordaje } from "@/lib/whatsapp-plantilla";
import { registrarInteraccion } from "@/lib/services/prospectos.service";
import { marcarAtendidoHumano } from "@/lib/whatsapp-segmento";
import { normalizarTelefonoAR } from "@/lib/telefono";

// Envía el abordaje (plantilla) a varios prospectos de una, respetando el tope
// de gasto mensual. Devuelve el resumen (enviados, sin teléfono, cortados).
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { prospectoIds, tipo } = await req.json();
  if (!Array.isArray(prospectoIds) || prospectoIds.length === 0) {
    return NextResponse.json({ error: "No hay prospectos para abordar" }, { status: 400 });
  }
  const tipoValido = ["mayorista", "empresa", "concesionaria"].includes(tipo) ? tipo : undefined;
  await ensureSchema("captacion");

  const ids = prospectoIds.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n)).slice(0, 300);
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, nombre, telefono, estado FROM prospectos WHERE id = ANY($1::int[])`, ids);

  let enviados = 0, sinTelefono = 0, cortadoPorPresupuesto = 0, errores = 0;

  for (const p of rows) {
    // Chequea el tope antes de cada envío.
    const presu = await presupuestoAbordaje();
    if (!presu.disponible) { cortadoPorPresupuesto = rows.length - enviados - sinTelefono - errores; break; }
    if (!p.telefono) { sinTelefono++; continue; }

    const norm = normalizarTelefonoAR(p.telefono);
    const destino = norm ? norm.replace("+", "") : String(p.telefono).replace(/[^\d]/g, "");
    const r = await enviarPlantillaAbordaje(destino, [String(p.nombre)], tipoValido);
    if (!r.ok) { errores++; continue; }
    enviados++;
    try {
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO whatsapp_mensajes (wa_id, direccion, texto) VALUES ($1, 'saliente', $2)`,
        destino, "📤 Abordaje (plantilla) enviado");
      await (prisma as any).$executeRawUnsafe(
        `UPDATE prospectos SET estado = CASE WHEN estado = 'nuevo' THEN 'contactado' ELSE estado END,
           contactado_en = COALESCE(contactado_en, now()) WHERE id = $1`, p.id);
      await registrarInteraccion(Number(p.id), { tipo: "contacto", canal: "whatsapp", detalle: "Abordaje en lote (plantilla)" });
      await marcarAtendidoHumano(destino);
    } catch { /* no crítico */ }
  }

  return NextResponse.json({ ok: true, enviados, sinTelefono, cortadoPorPresupuesto, errores });
}
