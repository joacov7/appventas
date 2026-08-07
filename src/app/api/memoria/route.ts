export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { stats, recall, forget } from "@/lib/memory";

// GET → estadísticas por espacio, o entradas de un espacio (?namespace=...&q=...)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const namespace = req.nextUrl.searchParams.get("namespace");
  const q = req.nextUrl.searchParams.get("q") ?? undefined;

  if (!namespace) {
    return NextResponse.json({ stats: await stats() });
  }
  const entries = await recall({ namespace, query: q, limit: 100 });
  return NextResponse.json({ entries });
}

// DELETE ?id=N → olvida una entrada
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await forget(Number(id));
  return NextResponse.json({ ok: true });
}
