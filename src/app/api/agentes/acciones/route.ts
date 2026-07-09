export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { registry } from "@/lib/tools";
import { remember } from "@/lib/memory";

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
    // Enriquecer con la descripción de la tool
    const acciones = rows.map(r => {
      const t = registry.get(r.tool);
      return { ...r, tool_desc: t?.description ?? null, tool_categoria: t?.category ?? null };
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
  const { id, decision } = await req.json();
  if (!id || !["aprobar", "rechazar"].includes(decision)) {
    return NextResponse.json({ error: "id y decision (aprobar|rechazar) requeridos" }, { status: 400 });
  }

  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM action_queue WHERE id = $1 AND estado = 'pendiente'`, Number(id)
  );
  const accion = rows[0];
  if (!accion) return NextResponse.json({ error: "Acción no encontrada o ya resuelta" }, { status: 404 });

  if (decision === "rechazar") {
    await (prisma as any).$executeRawUnsafe(
      `UPDATE action_queue SET estado = 'rechazada', resuelto_en = now() WHERE id = $1`, Number(id)
    );
    // Aprender del rechazo
    remember({
      namespace: "decisiones", kind: "accion_rechazada",
      key: `accion:${id}`, value: { agente: accion.agent_id, tool: accion.tool, input: accion.input },
      source: "aprobaciones", tags: ["rechazada", accion.tool], confidence: 0.7,
    }).catch(() => {});
    return NextResponse.json({ ok: true, estado: "rechazada" });
  }

  // Aprobar → ejecutar la tool realmente
  const result = await registry.execute(accion.tool, accion.input ?? {});
  await (prisma as any).$executeRawUnsafe(
    `UPDATE action_queue SET estado = $2, resultado = $3::jsonb, resuelto_en = now() WHERE id = $1`,
    Number(id), result.ok ? "ejecutada" : "error", JSON.stringify(result)
  );
  if (result.ok) {
    remember({
      namespace: "decisiones", kind: "accion_aprobada",
      key: `accion:${id}`, value: { agente: accion.agent_id, tool: accion.tool, input: accion.input },
      source: "aprobaciones", tags: ["aprobada", accion.tool], confidence: 0.8,
    }).catch(() => {});
  }
  return NextResponse.json({ ok: result.ok, estado: result.ok ? "ejecutada" : "error", resultado: result });
}
