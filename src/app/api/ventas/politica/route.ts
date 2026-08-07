export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { loadPoliticaVentas, savePoliticaVentas } from "@/lib/bot-config";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  return NextResponse.json(await loadPoliticaVentas());
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = await req.json();
  await savePoliticaVentas(body);
  return NextResponse.json({ ok: true, ...(await loadPoliticaVentas()) });
}
