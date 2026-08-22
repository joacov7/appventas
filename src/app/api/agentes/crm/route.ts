export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { scoringClientes } from "@/lib/services/crm.service";

// GET → clientes con su Customer Score, ordenados por score. ?limit=N
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 100;
  const clientes = await scoringClientes(limit);
  return NextResponse.json({ total: clientes.length, clientes });
}
