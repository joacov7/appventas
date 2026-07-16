export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// Carga stock masivo a las variantes activas. Por defecto solo las que están
// en 0 (para no pisar lo ya cargado a mano). `soloVacios: false` fuerza a todas.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { cantidad, soloVacios } = await req.json();
  const n = Math.max(0, Math.round(Number(cantidad)));
  if (!Number.isFinite(n)) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const soloCero = soloVacios !== false; // default: solo los que están en 0
  try {
    const upd: any = await (prisma as any).$executeRawUnsafe(
      `UPDATE product_variants SET stock = ${n} WHERE active = true ${soloCero ? "AND stock = 0" : ""}`
    );
    return NextResponse.json({ ok: true, actualizados: Number(upd ?? 0), cantidad: n, soloVacios: soloCero });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
