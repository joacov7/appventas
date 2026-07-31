export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { resumenGastoIA, loadPresupuestoIA, savePresupuestoIA } from "@/lib/ai";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json(await resumenGastoIA());
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { limite_usd, cortar } = await req.json();
  await savePresupuestoIA({ limite_usd: Number(limite_usd) || 0, cortar: !!cortar });
  return NextResponse.json({ ok: true, ...(await loadPresupuestoIA()) });
}
