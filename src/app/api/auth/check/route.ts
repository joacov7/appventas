export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/admin-token";

export async function GET() {
  const adminSecret = process.env.ADMIN_SECRET;
  const store = await cookies();
  const token = store.get("admin-token")?.value;

  if (!adminSecret) {
    return NextResponse.json({ admin: false, reason: "ADMIN_SECRET no configurado en el servidor" });
  }
  if (!token) {
    return NextResponse.json({ admin: false, reason: "Cookie admin-token no encontrada — necesitás iniciar sesión" });
  }
  if (!(await verifyAdminToken(token, adminSecret))) {
    return NextResponse.json({ admin: false, reason: "Sesión inválida o vencida — volvé a iniciar sesión" });
  }
  return NextResponse.json({ admin: true });
}
