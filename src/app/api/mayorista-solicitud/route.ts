export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const { nombre, empresa, telefono, email, mensaje } = await req.json();
  if (!nombre || !telefono || !email) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  try {
    await ensureSchema("captacion");
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO mayorista_solicitudes (nombre, empresa, telefono, email, mensaje)
      VALUES ($1, $2, $3, $4, $5)
    `, nombre, empresa ?? null, telefono, email, mensaje ?? null);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
