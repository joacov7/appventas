export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { agregarProspecto } from "@/lib/services/prospectos.service";

// Agenda un contacto de la Bandeja como prospecto en Captación.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { contacto, nombre, rubro, email, provincia, notas } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

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
