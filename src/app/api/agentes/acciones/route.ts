export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { registry } from "@/lib/tools";
import { aprobarAccion, rechazarAccion } from "@/lib/agents/acciones-exec";

async function ensureCols() {
  // Asegura que la tabla y TODAS sus columnas existan. Tablas viejas de prod
  // podían no tener created_at/estado, y eso hacía fallar el SELECT ... ORDER BY
  // created_at (devolvía vacío en silencio, tanto Pendientes como Historial).
  await ensureSchema("agentes");
  const alters = [
    `ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default'`,
    `ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS agent_id TEXT`,
    `ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS tool TEXT`,
    `ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS input JSONB`,
    `ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente'`,
    `ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`,
    `ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS resultado JSONB`,
    `ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS resuelto_en TIMESTAMPTZ`,
  ];
  for (const a of alters) await (prisma as any).$executeRawUnsafe(a).catch(() => {});
}

// GET → acciones pendientes de aprobación (y opcionalmente el historial).
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureCols();
  const historial = req.nextUrl.searchParams.get("historial") === "1";
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      historial
        ? `SELECT * FROM action_queue ORDER BY created_at DESC LIMIT 50`
        : `SELECT * FROM action_queue WHERE estado = 'pendiente' ORDER BY created_at DESC LIMIT 50`
    );
    // Enriquecer con la descripción de la tool. El id viene como BigInt
    // (BIGSERIAL) y hay que convertirlo o JSON.stringify falla.
    const acciones = rows.map(r => {
      const t = registry.get(r.tool);
      return { ...r, id: Number(r.id), tool_desc: t?.description ?? null, tool_categoria: t?.category ?? null };
    });
    return NextResponse.json({ acciones });
  } catch (e: any) {
    // Surfaceamos el error para diagnóstico (antes se tragaba y quedaba vacío).
    return NextResponse.json({ acciones: [], error: e?.message ?? "error leyendo acciones" });
  }
}

// POST → aprobar (ejecuta la tool) o rechazar una acción.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureCols();
  const { id, decision, input: inputEditado } = await req.json();
  if (!id || !["aprobar", "rechazar"].includes(decision)) {
    return NextResponse.json({ error: "id y decision (aprobar|rechazar) requeridos" }, { status: 400 });
  }

  // Aprobar/rechazar reutilizando la lógica compartida (con enforcement).
  if (decision === "rechazar") {
    const r = await rechazarAccion(Number(id));
    if (!r.ok && r.estado === "no_encontrada") return NextResponse.json({ error: r.motivo }, { status: 404 });
    return NextResponse.json({ ok: r.ok, estado: r.estado });
  }
  const r = await aprobarAccion(Number(id), inputEditado);
  if (r.estado === "no_encontrada") return NextResponse.json({ error: r.motivo }, { status: 404 });
  if (r.estado === "bloqueada") return NextResponse.json({ error: `Bloqueado por política: ${r.motivo}`, motivo: r.motivo }, { status: 422 });
  return NextResponse.json({ ok: r.ok, estado: r.estado, resultado: r.resultado });
}
