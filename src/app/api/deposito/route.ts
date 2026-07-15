export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { pedidosParaArmar } from "@/lib/services/deposito.service";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  try {
    return NextResponse.json(await pedidosParaArmar());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
