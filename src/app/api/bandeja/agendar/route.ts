export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { agregarProspecto } from "@/lib/services/prospectos.service";
import { normalizarTelefonoAR } from "@/lib/telefono";

// Agenda un contacto de la Bandeja como prospecto en Captación.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { contacto, nombre, rubro, email, provincia, notas, forzar } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  // Aviso de duplicado: ¿ya existe un prospecto con ese teléfono?
  if (contacto && !forzar) {
    try {
      await ensureSchema("captacion");
      const norm = normalizarTelefonoAR(contacto);
      const rows: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT id, nombre FROM prospectos
         WHERE telefono = $1 OR telefono_norm = $2 OR telefono = $2 LIMIT 1`,
        contacto, norm ?? contacto);
      if (rows[0]) {
        return NextResponse.json(
          { yaExiste: true, prospecto: rows[0], error: `Este número ya está agendado como "${rows[0].nombre}".` },
          { status: 409 });
      }
    } catch { /* si falla la verificación, seguimos y agendamos */ }
  }

  const r = await agregarProspecto({
    nombre,
    telefono: contacto || undefined,
    rubro: rubro || undefined,
    email: email || undefined,
    provincia: provincia || undefined,
    notas: notas?.trim() || "Agendado desde la Bandeja (WhatsApp entrante)",
  });
  if (!r) return NextResponse.json({ error: "No se pudo agendar" }, { status: 500 });
  return NextResponse.json({ ok: true, id: r.id });
}
