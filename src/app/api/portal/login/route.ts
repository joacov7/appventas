export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { buscarClientePorEmail } from "@/lib/services/clientes.service";
import { verifyPassword } from "@/lib/password";
import { signSessionToken } from "@/lib/admin-token";
import { CLIENTE_COOKIE } from "@/lib/cliente-auth";

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return NextResponse.json({ error: "No configurado" }, { status: 500 });
  const { email, password } = await req.json();

  const c = await buscarClientePorEmail(String(email ?? "")).catch(() => null);
  if (!c || !(await verifyPassword(String(password ?? ""), c.password_hash))) {
    return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  }
  if (!c.aprobado) return NextResponse.json({ error: "Tu cuenta todavía está pendiente de aprobación. Te avisamos cuando esté lista." }, { status: 403 });
  if (!c.activo) return NextResponse.json({ error: "Tu cuenta está inactiva. Escribinos para reactivarla." }, { status: 403 });

  const token = await signSessionToken(secret, c.email, "cliente");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLIENTE_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  return res;
}
