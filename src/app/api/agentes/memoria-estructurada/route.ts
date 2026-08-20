export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { recordarDecision, decisionesDeEntidad, recordarReglaEmpresa, reglasEmpresa } from "@/lib/agents/memoria-estructurada";

// GET → decisiones de una entidad (?entityType=&entityId=) o reglas de empresa.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const et = sp.get("entityType"), ei = sp.get("entityId");
  if (et && ei) {
    return NextResponse.json({ decisiones: await decisionesDeEntidad(et, ei) });
  }
  return NextResponse.json({ reglas: await reglasEmpresa() });
}

// POST → registra una decisión del usuario, o una regla de empresa.
//  { tipo:'decision', actor?, accion, entityType, entityId, motivo?, vigenciaDias?, kind? }
//  { tipo:'regla', clave, value }
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b?.tipo === "regla") {
    if (!b.clave) return NextResponse.json({ error: "clave requerida" }, { status: 400 });
    await recordarReglaEmpresa(String(b.clave), b.value ?? null, "usuario");
    return NextResponse.json({ ok: true });
  }

  if (!b?.accion || !b?.entityType || !b?.entityId) {
    return NextResponse.json({ error: "accion, entityType y entityId requeridos" }, { status: 400 });
  }
  await recordarDecision({
    actor: b.actor ?? "usuario", accion: String(b.accion),
    entityType: String(b.entityType), entityId: String(b.entityId),
    motivo: b.motivo ?? null, vigenciaDias: b.vigenciaDias ?? null,
    kind: b.kind === "preferencia" ? "preferencia" : "rechazo",
  });
  return NextResponse.json({ ok: true });
}
