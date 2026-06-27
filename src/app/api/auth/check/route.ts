export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
  if (token !== adminSecret) {
    return NextResponse.json({ admin: false, reason: "Cookie inválida — el secreto cambió, volvé a iniciar sesión" });
  }
  return NextResponse.json({ admin: true });
}
