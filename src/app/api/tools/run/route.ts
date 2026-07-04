export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { registry } from "@/lib/tools";

// Ejecuta una tool (admin). Base para el motor de agentes y para probar tools.
// En Fase 1 solo se permiten tools de lectura desde este endpoint.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { tool, input } = await req.json();
  if (!tool) return NextResponse.json({ error: "tool requerido" }, { status: 400 });

  const def = registry.get(tool);
  if (!def) return NextResponse.json({ error: `Tool "${tool}" no existe` }, { status: 404 });
  if (def.sideEffect === "write") {
    return NextResponse.json({ error: "Las tools de escritura se ejecutan solo desde el motor de agentes (con permisos)." }, { status: 403 });
  }

  const result = await registry.execute(tool, input ?? {});
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
