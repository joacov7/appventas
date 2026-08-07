export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listarInteracciones, registrarInteraccion } from "@/lib/services/prospectos.service";

// Historial de interacciones de un prospecto.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await listarInteracciones(Number(id)));
}

// Registra una interacción (contacto por WhatsApp, nota, etc.).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const { tipo, canal, detalle } = await req.json();
  if (!tipo) return NextResponse.json({ error: "tipo requerido" }, { status: 400 });
  await registrarInteraccion(Number(id), { tipo: String(tipo), canal, detalle });
  return NextResponse.json({ ok: true });
}
