export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listarClientes, actualizarCliente, eliminarCliente } from "@/lib/services/clientes.service";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json({ clientes: await listarClientes() });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id, ...cambios } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const r = await actualizarCliente(Number(id), cambios);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await eliminarCliente(Number(id));
  return NextResponse.json({ ok: true });
}
