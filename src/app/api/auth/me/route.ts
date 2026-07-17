export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSesion } from "@/lib/admin-auth";

// Devuelve el rol de la sesión actual (para filtrar el menú en el cliente).
export async function GET() {
  const s = await getSesion();
  if (!s) return NextResponse.json({ rol: null }, { status: 200 });
  return NextResponse.json({ rol: s.rol, sub: s.sub });
}
