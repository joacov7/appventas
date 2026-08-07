export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { tieneRol } from "@/lib/admin-auth";
import {
  getPreparacion, iniciarPreparacion, actualizarItem, cerrarPreparacion, marcarDespachado,
} from "@/lib/services/deposito.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!(await tieneRol("admin", "deposito"))) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { orderId } = await params;
  const p = await getPreparacion(orderId);
  if (!p) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  return NextResponse.json(p);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (!(await tieneRol("admin", "deposito"))) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { orderId } = await params;
  const body = await req.json();
  try {
    switch (body.accion) {
      case "iniciar":
        await iniciarPreparacion(orderId, String(body.armador ?? ""));
        break;
      case "item":
        await actualizarItem(orderId, String(body.orderItemId), Number(body.controlado) || 0, Number(body.faltante) || 0);
        break;
      case "cerrar": {
        const r = await cerrarPreparacion(orderId);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        return NextResponse.json({ ok: true, estado: r.estado });
      }
      case "despachar":
        await marcarDespachado(orderId);
        break;
      default:
        return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }
    return NextResponse.json(await getPreparacion(orderId));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
