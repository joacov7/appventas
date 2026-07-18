export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { registrarCliente } from "@/lib/services/clientes.service";
import { enviarAlertaTelegram } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const r = await registrarCliente(body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  // Aviso al dueño para que apruebe la cuenta.
  enviarAlertaTelegram(
    `🆕 <b>Nuevo cliente mayorista</b>\n${body.empresa ? `Empresa: ${body.empresa}\n` : ""}${body.nombre ? `Nombre: ${body.nombre}\n` : ""}Email: ${body.email}\n\nAprobalo en Admin → Clientes mayoristas.`
  ).catch(() => {});
  return NextResponse.json({ ok: true });
}
