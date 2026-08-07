import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { registrarInteraccion } from "@/lib/services/prospectos.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const { estado, notas, mensaje_abordaje } = await req.json();
  await ensureSchema("captacion");

  const sets: string[] = [];
  const args: any[] = [];
  let idx = 1;
  if (estado !== undefined) {
    sets.push(`estado = $${idx++}`); args.push(String(estado));
    // Marca cuándo se contactó por primera vez (para el seguimiento).
    if (estado === "contactado" || estado === "interesado") {
      sets.push(`contactado_en = COALESCE(contactado_en, now())`);
    }
  }
  if (notas !== undefined)  { sets.push(`notas = $${idx++}`);  args.push(notas === null ? null : String(notas)); }
  if (mensaje_abordaje !== undefined) { sets.push(`mensaje_abordaje = $${idx++}`); args.push(mensaje_abordaje === null ? null : String(mensaje_abordaje)); }
  if (!sets.length) return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });

  args.push(Number(id));
  const rows = await (prisma as any).$queryRawUnsafe(
    `UPDATE prospectos SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, ...args
  );
  if (estado !== undefined) {
    await registrarInteraccion(Number(id), { tipo: "estado", detalle: `Pasó a "${estado}"` });
  }
  if (mensaje_abordaje !== undefined && mensaje_abordaje) {
    await registrarInteraccion(Number(id), { tipo: "abordaje", detalle: `Mensaje escrito a mano` });
  }
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  await (prisma as any).$executeRawUnsafe(`DELETE FROM prospectos WHERE id = $1`, Number(id));
  return NextResponse.json({ ok: true });
}
